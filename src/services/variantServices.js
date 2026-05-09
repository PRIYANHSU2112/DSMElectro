import variantModel from "../model/variant.model.js";
import productModel from "../model/product.model.js";
import redisClient from "../config/redis.js";
import mongoose from "mongoose";
import { AppError } from "../utils/apiResponse.js";

export default class VariantService {
  // CREATE
  static async createVariant(payload) {
    const product = await productModel.findById(payload.productId);

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const variant = await variantModel.create({
      ...payload,
      category: product.categoryId,
      subCategory: product.subCategoryId,
      brand: product.brandId,
    });

    await redisClient.del("variants:list");
    await redisClient.del(`variants:product:${payload.productId}`);

    return variant;
  }

  // UPDATE
  static async updateVariant(id, payload) {
    const variant = await variantModel.findByIdAndUpdate(id, payload, {
      new: true,
    });

    if (!variant) {
      throw new AppError("Variant not found", 404);
    }

    await redisClient.del("variants:list");
    await redisClient.del(`variant:${id}`);
    await redisClient.del(`variants:product:${variant.productId}`);

    return variant;
  }

  // DELETE
  static async deleteVariant(id) {
    const variant = await variantModel.findById(id);

    if (!variant) {
      throw new AppError("Variant not found", 404);
    }

    await variant.deleteOne();

    await redisClient.del("variants:list");
    await redisClient.del(`variant:${id}`);
    await redisClient.del(`variants:product:${variant.productId}`);

    return true;
  }

  // DISABLE / ENABLE
  static async toggleVariant(id) {
    const variant = await variantModel.findById(id);

    if (!variant) {
      throw new AppError("Variant not found", 404);
    }

    variant.disable = !variant.disable;

    await variant.save();

    await redisClient.del("variants:list");
    await redisClient.del(`variant:${id}`);

    return variant;
  }

  // GET BY ID
  static async getVariantById(id) {
    const cacheKey = `variant:${id}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const variant = await variantModel.findById(id).lean();

    if (!variant) {
      throw new AppError("Variant not found", 404);
    }

    await redisClient.setEx(cacheKey, 300, JSON.stringify(variant));

    return variant;
  }

  // GET ALL
  static async getVariants(query) {
    const {
      page = 1,
      limit = 10,
      productId,
      category,
      brand,
      subCategory,
      disable,
    } = query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter safely
    const filter = { disable: false };

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
    }

    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      filter.brand = new mongoose.Types.ObjectId(brand);
    }

    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      filter.subCategory = new mongoose.Types.ObjectId(subCategory);
    }

    if (disable !== undefined) {
      filter.disable = disable === "true";
    }

    // Cache key
    const cacheKey = `variants:${JSON.stringify({
      ...filter,
      page: pageNumber,
      limit: limitNumber,
    })}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: filter },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNumber },
          ],
          totalCount: [{ $count: "total" }],
        },
      },
      {
        $project: {
          data: 1,
          total: {
            $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0],
          },
        },
      },
    ];

    const result = await variantModel.aggregate(pipeline);

    const finalResult = {
      data: result[0].data,
      total: result[0].total,
      page: pageNumber,
      limit: limitNumber,
      totalPages:
        result[0].total > 0 ? Math.ceil(result[0].total / limitNumber) : 0,
    };

    // Cache result for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(finalResult));

    return finalResult;
  }

  // get All varints admin
  static async getVariantsAdmin(query) {
    const {
      page = 1,
      limit = 10,
      productId,
      category,
      brand,
      subCategory,
      disable,
    } = query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const filter = {};

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
    }

    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      filter.brand = new mongoose.Types.ObjectId(brand);
    }

    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      filter.subCategory = new mongoose.Types.ObjectId(subCategory);
    }

    // Optional filter for admin
    if (disable !== undefined) {
      filter.disable = disable === "true";
    }

    const cacheKey = `variants:admin:${JSON.stringify({
      ...filter,
      page: pageNumber,
      limit: limitNumber,
    })}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const pipeline = [
      { $match: filter },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNumber },
          ],
          totalCount: [{ $count: "total" }],
        },
      },
      {
        $project: {
          data: 1,
          total: {
            $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0],
          },
        },
      },
    ];

    const result = await variantModel.aggregate(pipeline);

    const finalResult = {
      data: result[0].data,
      total: result[0].total,
      page: pageNumber,
      limit: limitNumber,
      totalPages:
        result[0].total > 0 ? Math.ceil(result[0].total / limitNumber) : 0,
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(finalResult));

    return finalResult;
  }

  // GET BY PRODUCT ID (FAST PATH)
  static async getVariantsByProduct(productId) {
    const cacheKey = `variants:product:${productId}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const variants = await variantModel
      .find({ productId, disable: false })
      .lean();

    await redisClient.setEx(cacheKey, 300, JSON.stringify(variants));

    return variants;
  }
}
