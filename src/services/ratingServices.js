import ratingModel from "../model/rating.model.js";
import productModel from "../model/product.model.js";
import redisClient from "../config/redis.js";
import mongoose from "mongoose";

export default class RatingService {
  // ADD / UPDATE RATING
  static async addRating(userId, payload) {
    const { productId, rating, comment } = payload;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // UPSERT
      const ratingDoc = await ratingModel.findOneAndUpdate(
        { productId, userId },
        { rating, comment },
        { new: true, upsert: true, session },
      );

      // CALCULATE AVG
      const stats = await ratingModel.aggregate([
        {
          $match: {
            productId: new mongoose.Types.ObjectId(productId),
          },
        },
        {
          $group: {
            _id: "$productId",
            avgRating: { $avg: "$rating" },
            totalRatings: { $sum: 1 },
          },
        },
      ]);

      const avgRating = stats[0]?.avgRating || 0;
      const totalRatings = stats[0]?.totalRatings || 0;

      await productModel.findByIdAndUpdate(
        productId,
        {
          avgRating: Number(avgRating.toFixed(1)),
          totalRatings,
        },
        { session },
      );

      await session.commitTransaction();

      //  CLEAR CACHE
      await redisClient.del(`ratings:${productId}`);

      return ratingDoc;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // GET RATINGS
  static async getRatings(productId, query = {}) {
    const { page, limit } = query;

    const cacheKey = `ratings:${productId}:${page || "all"}:${limit || "all"}`;

    // CACHE CHECK
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const matchStage = {
      productId: new mongoose.Types.ObjectId(productId),
    };

    const pipeline = [
      {
        $match: matchStage,
      },

      // JOIN USER
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },

      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 1,
          rating: 1,
          comment: 1,
          createdAt: 1,

          user: {
            _id: "$user._id",
            name: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ["$user.firstName", ""] },
                    " ",
                    { $ifNull: ["$user.lastName", ""] },
                  ],
                },
              },
            },
            phone: "$user.number",
            disable: "$user.disable",
            image: "$user.image",
          },
        },
      },

      {
        $sort: { createdAt: -1 },
      },
    ];

    // ✅ ADD STATS CALCULATION (NEW)
    const statsPromise = ratingModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    let pagination = null;

    if (page && limit) {
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);

      const skip = (pageNumber - 1) * limitNumber;

      pipeline.push({
        $facet: {
          data: [{ $skip: skip }, { $limit: limitNumber }],
          totalCount: [{ $count: "total" }],
        },
      });

      pipeline.push({
        $project: {
          data: 1,
          total: {
            $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0],
          },
        },
      });
    }

    const [result, stats] = await Promise.all([
      ratingModel.aggregate(pipeline),
      statsPromise,
    ]);

    const avgRating = Number((stats[0]?.avgRating || 0).toFixed(1));
    const totalRatings = stats[0]?.totalRatings || 0;

    let finalResult;

    if (page && limit) {
      const total = result[0]?.total || 0;

      finalResult = {
        ratings: result[0]?.data || [],
        avgRating,
        totalRatings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: total > 0 ? Math.ceil(total / limit) : 0,
        },
      };
    } else {
      finalResult = {
        ratings: result,
        avgRating,
        totalRatings,
        pagination: null,
      };
    }

    // STORE CACHE
    await redisClient.setEx(cacheKey, 300, JSON.stringify(finalResult));

    return finalResult;
  }
}
