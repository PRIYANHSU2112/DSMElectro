import productModel from "../model/product.model.js";
import cartModel from "../model/cart.model.js";
import variantModel from "../model/variant.model.js";
import subCategoryModel from "../model/subCategory.model.js";
import brandModel from "../model/brand.model.js";
import categoryModel from "../model/category.model.js";
import { AppError } from "../utils/apiResponse.js";
import redisClient from "../config/redis.js";
import mongoose from "mongoose";

export default class ProductService {
  // //  CREATE PRODUCT + MULTIPLE VARIANTS
  // static async createProductWithVariant(payload) {
  //   const { variant, ...productData } = payload;

  //   const product = await productModel.create({
  //     ...productData,
  //     subCategoryId: payload.subCategoryId,
  //     brandId: payload.brandId,
  //   });

  //   const sharedFields = {
  //     productId: product._id,
  //     category: product.categoryId,
  //     subCategory: product.subCategoryId,
  //     brand: product.brandId,
  //   };

  //   const variantsToInsert = (Array.isArray(variant) ? variant : [variant]).map(
  //     (v) => ({ ...v, ...sharedFields }),
  //   );

  //   Promise.resolve().then(async () => {
  //     try {
  //       await variantModel.insertMany(variantsToInsert, { ordered: false });
  //       await redisClient.unlink("products:list");
  //     } catch (err) {
  //       console.error("Variant insert failed:", err.message);
  //     }
  //   });

  //   return { product, variants: [] };
  // }

  static async createProductWithVariant(payload) {
    const { variant, ...productData } = payload;


    const product = await productModel.create({
      ...productData,
      subCategoryId: payload.subCategoryId,
      brandId: payload.brandId,
    });

    const sharedFields = {
      productId: product._id,
      category: product.categoryId,
      subCategory: product.subCategoryId,
      brand: product.brandId,
    };

    const variantsToInsert = (Array.isArray(variant) ? variant : [variant]).map(
      (v) => ({ ...v, ...sharedFields }),
    );

    Promise.resolve().then(async () => {
      try {
        await variantModel.insertMany(variantsToInsert, { ordered: false });
        await redisClient.unlink("products:list");
      } catch (err) {
        console.error("Variant insert failed:", err.message);
      }
    });

    return { product, variants: [] };
  }

  // UPDATE PRODUCT
  static async updateProduct(productId, payload, files) {
    const product = await productModel.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    // ───────────── PARSE LOCATION ─────────────
    const locationFields = ["countries", "states", "cities", "pincodes"];

    for (const field of locationFields) {
      const val = payload[field];
      if (!val) continue;

      try {
        let parsed = typeof val === "string" ? JSON.parse(val) : val;
        payload[field] = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        throw new AppError(`Invalid ${field} format`, 400);
      }
    }

    // ───────────── PARSE DELIVERY ─────────────
    if (
      payload.minDeliveryCharge &&
      typeof payload.minDeliveryCharge === "string"
    ) {
      try {
        payload.minDeliveryCharge = JSON.parse(payload.minDeliveryCharge);
      } catch {
        throw new AppError("Invalid minDeliveryCharge format", 400);
      }
    }


    // ───────────── UPDATE DATA ─────────────
    const updateData = {
      ...payload,
      ...(files?.icon?.[0] && { icon: files.icon[0].location }),
      ...(files?.images?.length && {
        images: files.images.map((f) => f.location),
      }),
    };

    if (payload.name) {
      const slugify = (await import("slugify")).default;
      updateData.slug = slugify(payload.name, {
        lower: true,
        strict: true,
      });
    }

    const updated = await productModel.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true },
    );


    // ───────────── CACHE CLEAR ─────────────
    await redisClient.del(`product:${productId}`);
    await redisClient.unlink("products:list");

    return updated;
  }

  // // getAllProducts

  // static async getAllProducts(query) {
  //   const {
  //     page,
  //     limit,
  //     search,
  //     category,
  //     brand,
  //     subCategory,
  //     disable,
  //     sortBy,
  //   } = query;

  //   const pageNumber = parseInt(page) || 1;
  //   const limitNumber = parseInt(limit);

  //   const skip =
  //     limitNumber && !isNaN(limitNumber) ? (pageNumber - 1) * limitNumber : 0;

  //   const match = {};

  //   if (search) {
  //     match.name = { $regex: search, $options: "i" };
  //   }

  //   if (category && mongoose.Types.ObjectId.isValid(category)) {
  //     match.category = new mongoose.Types.ObjectId(category);
  //   }

  //   if (brand && mongoose.Types.ObjectId.isValid(brand)) {
  //     match.brand = new mongoose.Types.ObjectId(brand);
  //   }

  //   if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
  //     match.subCategory = new mongoose.Types.ObjectId(subCategory);
  //   }

  //   if (disable !== undefined) {
  //     match.disable = disable === "true";
  //   }

  //   const cacheKey = `products:admin:${JSON.stringify({
  //     ...match,
  //     sortBy,
  //     page: pageNumber,
  //     limit: limitNumber,
  //   })}`;

  //   const cached = await redisClient.get(cacheKey);
  //   if (cached) return JSON.parse(cached);

  //   let sortStage = { createdAt: -1 };
  //   if (sortBy === "price_asc") sortStage = { price: 1 };
  //   if (sortBy === "price_desc") sortStage = { price: -1 };

  //   // ✅ FIXED PART (dynamic pipeline)
  //   const dataPipeline = [{ $sort: sortStage }];

  //   if (limitNumber && !isNaN(limitNumber)) {
  //     dataPipeline.push({ $skip: skip }, { $limit: limitNumber });
  //   }

  //   dataPipeline.push({
  //     $project: {
  //       variants: 0,
  //       variant: 0,
  //     },
  //   });

  //   const pipeline = [
  //     { $match: match },

  //     {
  //       $lookup: {
  //         from: "variants",
  //         localField: "_id",
  //         foreignField: "productId",
  //         as: "variants",
  //       },
  //     },

  //     {
  //       $addFields: {
  //         variant: { $arrayElemAt: ["$variants", 0] },
  //         price: "$variant.mrp",
  //       },
  //     },

  //     {
  //       $facet: {
  //         data: dataPipeline,
  //         totalCount: [{ $count: "total" }],
  //       },
  //     },

  //     {
  //       $project: {
  //         data: 1,
  //         total: {
  //           $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0],
  //         },
  //       },
  //     },
  //   ];

  //   const result = await productModel.aggregate(pipeline);

  //   const finalResult = {
  //     products: result[0].data,
  //     pagination: {
  //       total: result[0].total,
  //       page: pageNumber,
  //       limit: limitNumber,
  //       totalPages:
  //         result[0].total > 0 && limitNumber
  //           ? Math.ceil(result[0].total / limitNumber)
  //           : 1,
  //     },
  //   };

  //   await redisClient.setEx(cacheKey, 300, JSON.stringify(finalResult));

  //   return finalResult;
  // }

  // get ALl products admin
  static async getAllProductsAdmin(query) {
    const {
      page,
      limit,
      search,
      category,
      brand,
      subCategory,
      disable,
      sortBy,
    } = query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;

    const skip =
      limitNumber && !isNaN(limitNumber) ? (pageNumber - 1) * limitNumber : 0;

    const match = {};

    if (search) {
      match.name = { $regex: search, $options: "i" };
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      match.categoryId = new mongoose.Types.ObjectId(category);
    }

    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      match.brandId = new mongoose.Types.ObjectId(brand);
    }

    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      match.subCategoryId = new mongoose.Types.ObjectId(subCategory);
    }

    if (disable !== undefined) {
      match.disable = disable === "true";
    }

    const cacheKey = `products:admin:${JSON.stringify({
      ...match,
      sortBy,
      page: pageNumber,
      limit: limitNumber,
    })}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let sortStage = { createdAt: -1 };
    if (sortBy === "price_asc") sortStage = { price: 1 };
    if (sortBy === "price_desc") sortStage = { price: -1 };

    // ✅ FIXED PART (dynamic pipeline)
    const dataPipeline = [{ $sort: sortStage }];

    if (limitNumber && !isNaN(limitNumber)) {
      dataPipeline.push({ $skip: skip }, { $limit: limitNumber });
    }

    dataPipeline.push({
      $project: {
        variants: 0,
        variant: 0,
      },
    });

    const pipeline = [
      { $match: match },

      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "variants",
        },
      },

      {
        $addFields: {
          variant: { $arrayElemAt: ["$variants", 0] },
          price: "$variant.mrp",
        },
      },

      {
        $facet: {
          data: dataPipeline,
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

    const result = await productModel.aggregate(pipeline);

    const finalResult = {
      products: result[0].data,
      pagination: {
        total: result[0].total,
        page: pageNumber,
        limit: limitNumber,
        totalPages:
          result[0].total > 0 && limitNumber
            ? Math.ceil(result[0].total / limitNumber)
            : 1,
      },
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(finalResult));

    return finalResult;
  }

  //  ADD VARIANT
  static async addVariant(productId, payload) {
    const product = await productModel.findById(productId);

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const variant = await variantModel.create({
      ...payload,
      productId: product._id,
      category: product.categoryId,
      subCategory: product.subCategoryId,
      brand: product.brandId,
    });

    await redisClient.del("products:list");

    return variant;
  }

  //  GET ALL PRODUCTS
  static async getAllProducts(query) {
    const {
      page,
      limit,
      search,
      category,
      brand,
      subCategory,
      city,
      pincode,
      sortBy,
      minPrice,
      maxPrice,
      rating,
    } = query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const skip =
      limitNumber && !isNaN(limitNumber) ? (pageNumber - 1) * limitNumber : 0;

    const match = { disable: false };

    if (search) {
      match.name = { $regex: search, $options: "i" };
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      match.categoryId = new mongoose.Types.ObjectId(category);
    }

    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      match.brandId = new mongoose.Types.ObjectId(brand);
    }

    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      match.subCategoryId = new mongoose.Types.ObjectId(subCategory);
    }

    if (city) match.city = city;
    if (pincode) match.pincode = pincode;

    if (rating) {
      match.avgRating = { $gte: Number(rating) };
    }

    const cacheKey = `products:user:${JSON.stringify({
      ...match,
      sortBy,
      page: pageNumber,
      limit: limitNumber,
      minPrice,
      maxPrice,
    })}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let sortStage = { createdAt: -1 };
    if (sortBy === "low") sortStage = { price: 1 };
    if (sortBy === "high") sortStage = { price: -1 };

    const postMatch = { price: { $ne: null } };
    if (minPrice || maxPrice) {
      postMatch.finalPrice = {};
      if (minPrice) postMatch.finalPrice.$gte = Number(minPrice);
      if (maxPrice) postMatch.finalPrice.$lte = Number(maxPrice);
    }

    const pipeline = [
      { $match: match },

      {
        $lookup: {
          from: "variants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                disable: false,
              },
            },
            { $sort: { createdAt: -1 } },
          ],
          as: "variants",
        },
      },

      {
        $addFields: {
          variant: { $arrayElemAt: ["$variants", 0] },
        },
      },

      {
        $addFields: {
          price: "$variant.mrp",
          finalPrice: "$variant.finalPrice",
          discount: "$variant.discount",
          discountAmount: "$variant.discountAmount",
        },
      },

      {
        $match: postMatch,
      },

      {
        $facet: {
          data: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limitNumber },
            {
              $project: {
                variants: 0,
                variant: 0,
              },
            },
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

    const result = await productModel.aggregate(pipeline);

    const finalResult = {
      products: result[0].data,
      pagination: {
        total: result[0].total,
        page: pageNumber,
        limit: limitNumber,
        totalPages:
          result[0].total > 0 ? Math.ceil(result[0].total / limitNumber) : 0,
      },
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(finalResult));

    return finalResult;
  }

  //  GET PRODUCT BY ID
  static async getProductById(productId) {
    const cacheKey = `product:${productId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const product = await productModel.findById(productId).lean();

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const variants = await variantModel
      .find({ productId, disable: false })
      .lean();

    const result = { product, variants };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  //  DELETE PRODUCT
  static async deleteProduct(productId) {
    const product = await productModel.findById(productId);

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    await variantModel.deleteMany({ productId });
    await product.deleteOne();

    await redisClient.del("products:list");
    await redisClient.del(`product:${productId}`);

    return true;
  }

  static async getProductWithVariants(id) {
    try {
      const cacheKey = `product:${id}`;

      // Cache check
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Product with important relations only
      const product = await productModel
        .findById(id)
        .populate("categoryId") // important
        .populate("subCategoryId") // important
        .populate("brandId") // important
        .lean();

      if (!product) {
        throw new Error("Product not found");
      }

      // All variants
      const variants = await variantModel.find({ productId: id }).lean();

      const result = {
        product,
        variants,
      };

      // Cache store
      await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

      return result;
    } catch (error) {
      throw error;
    }
  }

  static async setCoinsReward(productId, coinsReward) {
    const val = Number(coinsReward);
    if (isNaN(val) || val < 0) throw new AppError("coinsReward must be a non-negative number", 400);

    const product = await productModel.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const [updatedProduct, variantResult] = await Promise.all([
      productModel.findByIdAndUpdate(
        productId,
        { $set: { coinsReward: val } },
        { new: true },
      ),
      variantModel.updateMany(
        { productId },
        { $set: { coinsReward: val } },
      ),
    ]);

    await Promise.all([
      redisClient.del(`product:${productId}`),
      redisClient.del(`variants:product:${productId}`),
      redisClient.unlink("products:list"),
    ]);

    return {
      product: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        coinsReward: updatedProduct.coinsReward,
      },
      variantsUpdated: variantResult.modifiedCount,
    };
  }

  static async setReferralCommission(productId, referralCommissionPercent) {
    const val = Number(referralCommissionPercent);
    if (isNaN(val) || val < 0 || val > 100) {
      throw new AppError("referralCommissionPercent must be between 0 and 100", 400);
    }

    const product = await productModel.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const [updatedProduct, variantResult] = await Promise.all([
      productModel.findByIdAndUpdate(
        productId,
        { $set: { referralCommissionPercent: val } },
        { new: true },
      ),
      variantModel.updateMany(
        { productId },
        { $set: { referralCommissionPercent: val } },
      ),
    ]);

    await Promise.all([
      redisClient.del(`product:${productId}`),
      redisClient.del(`variants:product:${productId}`),
      redisClient.unlink("products:list"),
    ]);

    return {
      product: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        referralCommissionPercent: updatedProduct.referralCommissionPercent,
      },
      variantsUpdated: variantResult.modifiedCount,
    };
  }

  /**
   * GET RELATED PRODUCTS BASED ON CART ITEMS
   */
  static async getRelatedByCart(userId) {
    const cacheKey = `products:related:cart:${userId}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis get error:", err.message);
    }

    const cart = await cartModel.findOne({ userId }).lean();
    if (!cart || !cart.items || cart.items.length === 0) {
      return [];
    }

    const productIdsInCart = cart.items
      .filter((item) => item.itemType === "variant")
      .map((item) => item.productId);

    const productsInCart = await productModel
      .find({ _id: { $in: productIdsInCart } })
      .select("categoryId subCategoryId")
      .lean();

    const categoryIds = [
      ...new Set(
        productsInCart.map((p) => p.categoryId?.toString()).filter(Boolean),
      ),
    ];
    const subCategoryIds = [
      ...new Set(
        productsInCart.map((p) => p.subCategoryId?.toString()).filter(Boolean),
      ),
    ];

    if (categoryIds.length === 0 && subCategoryIds.length === 0) {
      return [];
    }

    const relatedProducts = await productModel.aggregate([
      {
        $match: {
          disable: { $ne: true },
          _id: { $nin: productIdsInCart },
          $or: [
            {
              categoryId: {
                $in: categoryIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
            {
              subCategoryId: {
                $in: subCategoryIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
          ],
        },
      },
      { $sample: { size: 10 } },
      {
        $lookup: {
          from: "variants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                disable: { $ne: true },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "variants",
        },
      },
      {
        $addFields: {
          variant: { $arrayElemAt: ["$variants", 0] },
        },
      },
      {
        $addFields: {
          price: "$variant.mrp",
          finalPrice: "$variant.finalPrice",
          discount: "$variant.discount",
          discountAmount: "$variant.discountAmount",
        },
      },
      {
        $project: {
          variants: 0,
          variant: 0,
        },
      },
    ]);

    try {
      await redisClient.setEx(cacheKey, 1800, JSON.stringify(relatedProducts));
    } catch (err) {
      console.error("Redis set error:", err.message);
    }

    return relatedProducts;
  }

  /**
   * GET TRENDING PRODUCTS (5-Signal Algorithm)
   */
  static async getTrendingProducts(query) {
    const { category, subCategory, brand, limit } = query;
    const limitNumber = parseInt(limit) || 10;

    const match = { 
      disable: { $ne: true },
      trending: true 
    };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      match.categoryId = new mongoose.Types.ObjectId(category);
    }
    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      match.brandId = new mongoose.Types.ObjectId(brand);
    }
    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      match.subCategoryId = new mongoose.Types.ObjectId(subCategory);
    }

    const cacheKey = `products:trending:${JSON.stringify({ match, limitNumber })}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis get error:", err.message);
    }

    const pipeline = [
      { $match: match },
      
      // Calculate 5-Signal Score
      {
        $addFields: {
          // 1. Sales Velocity (35%)
          // (avgLast7 / max(avgPrev14, 1)) / 3 * 35
          salesScore: {
            $multiply: [
              {
                $divide: [
                  {
                    $min: [
                      {
                        $divide: [
                          { $divide: [{ $ifNull: ["$analytics.salesLast7Days", 0] }, 7] },
                          { $max: [{ $divide: [{ $ifNull: ["$analytics.salesPrevious14Days", 0] }, 14] }, 1] }
                        ]
                      },
                      3 // Cap at 3x growth
                    ]
                  },
                  3
                ]
              },
              35
            ]
          },

          // 2. View Momentum (25%)
          // (viewsLast7 / max(viewsPrev7, 1)) / 2 * 25
          viewScore: {
            $multiply: [
              {
                $divide: [
                  {
                    $min: [
                      {
                        $divide: [
                          { $ifNull: ["$analytics.viewsLast7Days", 0] },
                          { $max: [{ $ifNull: ["$analytics.viewsPrevious7Days", 0] }, 1] }
                        ]
                      },
                      2 // Cap at 2x growth
                    ]
                  },
                  2
                ]
              },
              25
            ]
          },

          // 3. Search Rank (20%)
          // Cap improvement between 0 and 20, score = improvement
          searchScore: {
            $max: [
              0,
              {
                $min: [
                  {
                    $subtract: [
                      { $ifNull: ["$analytics.previousSearchRank", 100] },
                      { $ifNull: ["$analytics.searchRank", 100] }
                    ]
                  },
                  20
                ]
              }
            ]
          },

          // 4. Add-to-Cart Rate (15%)
          // (cartAdds / max(views, 1)) / 0.2 * 15
          cartScore: {
            $multiply: [
              {
                $divide: [
                  {
                    $min: [
                      {
                        $divide: [
                          { $ifNull: ["$analytics.cartAddsLast7Days", 0] },
                          { $max: [{ $ifNull: ["$analytics.viewsLast7Days", 0] }, 1] }
                        ]
                      },
                      0.2 // Cap at 20% conversion
                    ]
                  },
                  0.2
                ]
              },
              15
            ]
          },

          // 5. Return Penalty (-5%)
          returnPenalty: {
            $multiply: [
              {
                $divide: [
                  {
                    $min: [
                      {
                        $divide: [
                          { $ifNull: ["$analytics.returnCountLast30Days", 0] },
                          { $max: [{ $ifNull: ["$analytics.salesLast7Days", 0] }, 1] }
                        ]
                      },
                      0.2 // Cap penalty at 20% return rate
                    ]
                  },
                  0.2
                ]
              },
              5
            ]
          }
        }
      },
      
      // Calculate Total Score
      {
        $addFields: {
          trendingScore: {
            $subtract: [
              { $add: ["$salesScore", "$viewScore", "$searchScore", "$cartScore"] },
              "$returnPenalty"
            ]
          }
        }
      },

      { $sort: { trendingScore: -1, createdAt: -1 } },
      { $limit: limitNumber },
      
      {
        $lookup: {
          from: "variants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                disable: { $ne: true },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "variants",
        },
      },
      {
        $addFields: {
          variant: { $arrayElemAt: ["$variants", 0] },
        },
      },
      {
        $addFields: {
          price: "$variant.mrp",
          finalPrice: "$variant.finalPrice",
          discount: "$variant.discount",
          discountAmount: "$variant.discountAmount",
        },
      },
      {
        $project: {
          variants: 0,
          variant: 0,
          salesScore: 0,
          viewScore: 0,
          searchScore: 0,
          cartScore: 0,
          returnPenalty: 0
        },
      },
    ];

    const trendingProducts = await productModel.aggregate(pipeline);

    try {
      await redisClient.setEx(cacheKey, 1800, JSON.stringify(trendingProducts));
    } catch (err) {
      console.error("Redis set error:", err.message);
    }

    return trendingProducts;
  }

  /**
   * GET NEW ARRIVAL PRODUCTS
   * Supports: page, limit, search, category, brand, subCategory
   * Returns: { products, pagination }
   * Cached in Redis for 20 min per unique filter combination.
   */
  static async getNewArrivalProducts(query) {
    const { page, limit, search, category, brand, subCategory } = query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const match = { disable: { $ne: true } };

    if (search) {
      match.name = { $regex: search, $options: "i" };
    }
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      match.categoryId = new mongoose.Types.ObjectId(category);
    }
    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      match.brandId = new mongoose.Types.ObjectId(brand);
    }
    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      match.subCategoryId = new mongoose.Types.ObjectId(subCategory);
    }

    const cacheKey = `products:new_arrivals:${JSON.stringify({ match, pageNumber, limitNumber })}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis get error:", err.message);
    }

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },

      {
        $lookup: {
          from: "variants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                disable: { $ne: true },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "variants",
        },
      },
      {
        $addFields: {
          variant: { $arrayElemAt: ["$variants", 0] },
        },
      },
      {
        $addFields: {
          price: "$variant.mrp",
          finalPrice: "$variant.finalPrice",
          discount: "$variant.discount",
          discountAmount: "$variant.discountAmount",
        },
      },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNumber },
            { $project: { variants: 0, variant: 0 } },
          ],
          totalCount: [{ $count: "total" }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0] },
        },
      },
    ];

    const result = await productModel.aggregate(pipeline);

    const finalResult = {
      products: result[0].data,
      pagination: {
        total: result[0].total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: result[0].total > 0 ? Math.ceil(result[0].total / limitNumber) : 0,
      },
    };

    try {
      await redisClient.setEx(cacheKey, 1200, JSON.stringify(finalResult));
    } catch (err) {
      console.error("Redis set error:", err.message);
    }

    return finalResult;
  }

  /**
   * GET BEST SELLING PRODUCTS
   * Ranks products by total unitsSold from non-cancelled/returned orders.
   * Supports: page, limit, search, category, brand, subCategory
   * Returns: { products, pagination }
   * Cached in Redis for 30 min per unique filter combination.
   */
  static async getBestSellingProducts(query) {
    const { page, limit, search, category, brand, subCategory } = query;

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // Build product filter match
    const productMatch = { disable: { $ne: true } };

    if (search) {
      productMatch.name = { $regex: search, $options: "i" };
    }
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      productMatch.categoryId = new mongoose.Types.ObjectId(category);
    }
    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      productMatch.brandId = new mongoose.Types.ObjectId(brand);
    }
    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      productMatch.subCategoryId = new mongoose.Types.ObjectId(subCategory);
    }

    const cacheKey = `products:best_selling:${JSON.stringify({ productMatch, pageNumber, limitNumber })}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis get error:", err.message);
    }

    // Step 1: Aggregate unitsSold from non-cancelled/returned orders
    const excludedStatuses = ["CANCELLED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURNED"];

    const salesPipeline = [
      { $match: { status: { $nin: excludedStatuses } } },
      { $unwind: "$product" },
      {
        $match: {
          "product.itemType": "variant",
          "product.status": { $nin: excludedStatuses },
          "product.productId": { $ne: null },
        },
      },
      {
        $group: {
          _id: "$product.productId",
          unitsSold: { $sum: "$product.quantity" },
        },
      },
      { $sort: { unitsSold: -1 } },
    ];

    const orderModel = (await import("../model/order.model.js")).default;
    const salesData = await orderModel.aggregate(salesPipeline);

    if (!salesData.length) {
      return { products: [], pagination: { total: 0, page: pageNumber, limit: limitNumber, totalPages: 0 } };
    }

    // Build salesMap for post-enrichment
    const salesMap = new Map(salesData.map((s) => [s._id.toString(), s.unitsSold]));
    const rankedProductIds = salesData.map((s) => s._id);

    // Step 2: Match products against ranked IDs + apply filters, then paginate
    const pipeline = [
      {
        $match: {
          ...productMatch,
          _id: { $in: rankedProductIds },
        },
      },

      // Inject unitsSold from salesData via $reduce so sort is inside aggregation
      {
        $addFields: {
          unitsSold: {
            $reduce: {
              input: salesData,
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ["$$this._id", "$_id"] },
                  "$$this.unitsSold",
                  "$$value",
                ],
              },
            },
          },
        },
      },

      { $sort: { unitsSold: -1 } },

      // Join cheapest active variant for pricing
      {
        $lookup: {
          from: "variants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                disable: { $ne: true },
              },
            },
            { $sort: { finalPrice: 1 } },
            { $limit: 1 },
          ],
          as: "variants",
        },
      },
      {
        $addFields: {
          variant: { $arrayElemAt: ["$variants", 0] },
        },
      },
      {
        $addFields: {
          price: "$variant.mrp",
          finalPrice: "$variant.finalPrice",
          discount: "$variant.discount",
          discountAmount: "$variant.discountAmount",
        },
      },

      // Paginate via $facet
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNumber },
            { $project: { variants: 0, variant: 0 } },
          ],
          totalCount: [{ $count: "total" }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0] },
        },
      },
    ];

    const result = await productModel.aggregate(pipeline);

    // Re-attach exact unitsSold from map (overrides $reduce for accuracy)
    const products = (result[0]?.data ?? []).map((p) => ({
      ...p,
      unitsSold: salesMap.get(p._id.toString()) ?? 0,
    }));

    const finalResult = {
      products,
      pagination: {
        total: result[0]?.total ?? 0,
        page: pageNumber,
        limit: limitNumber,
        totalPages: (result[0]?.total ?? 0) > 0 ? Math.ceil(result[0].total / limitNumber) : 0,
      },
    };

    try {
      await redisClient.setEx(cacheKey, 1800, JSON.stringify(finalResult));
    } catch (err) {
      console.error("Redis set error:", err.message);
    }

    return finalResult;
  }

  // ── RELATED PRODUCTS ──────────────────────────────────────────────────────
  /**
   * getRelatedProducts({ categoryId, subCategoryId, limit })
   *
   * Caller passes categoryId and/or subCategoryId directly (from the
   * product detail page). No extra DB lookup needed.
   *
   * STRATEGY:
   *  1. subCategoryId given → fill up to `limit` from same sub-category
   *  2. categoryId given    → top-up remaining slots from same category
   *                           (excluding subCategoryId bucket to avoid duplicates)
   *  3. Only subCategoryId  → results from sub-category only
   *  4. Only categoryId     → results from category only
   *
   * CACHE KEYS (shared across all products in same category/sub-category):
   *  "products:related:sub:<subCategoryId>:<limit>"  TTL 10 min
   *  "products:related:cat:<categoryId>:<limit>"     TTL 10 min
   *
   * RESPONSE per product:
   *  { _id, name, slug, icon, avgRating, totalRatings,
   *    categoryId, subCategoryId, brandId,
   *    variant: { _id, mrp, finalPrice, discount, discountAmount } }
   */
  static async getRelatedProducts({ categoryId, subCategoryId, limit } = {}) {
    const lim = Math.min(parseInt(limit) || 10, 30); // cap at 30

    // Validate: at least one ID must be provided
    if (!categoryId && !subCategoryId) {
      throw new AppError("Provide at least categoryId or subCategoryId", 400);
    }

    const catId    = categoryId    && mongoose.Types.ObjectId.isValid(categoryId)    ? categoryId    : null;
    const subCatId = subCategoryId && mongoose.Types.ObjectId.isValid(subCategoryId) ? subCategoryId : null;

    // ── Pipeline factory ──────────────────────────────────────────────────
    // Builds aggregation: match → $sample → $lookup variant → project
    const buildPipeline = (matchFilter, sampleSize) => [
      {
        $match: {
          ...matchFilter,
          disable: { $ne: true },
        },
      },
      { $sample: { size: sampleSize } }, // random variety on every cache miss
      {
        $lookup: {
          from: "variants",
          let:  { pid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr:   { $eq: ["$productId", "$$pid"] },
                disable: { $ne: true },
              },
            },
            { $sort: { finalPrice: 1 } }, // cheapest variant
            { $limit: 1 },
            {
              $project: {
                _id: 1, mrp: 1, finalPrice: 1,
                discount: 1, discountAmount: 1,
              },
            },
          ],
          as: "variants",
        },
      },
      { $match: { "variants.0": { $exists: true } } }, // must have at least 1 active variant
      {
        $project: {
          name: 1, slug: 1, icon: 1,
          avgRating: 1, totalRatings: 1,
          categoryId: 1, subCategoryId: 1, brandId: 1,
          variant: { $arrayElemAt: ["$variants", 0] },
        },
      },
    ];

    // ── BUCKET 1: Sub-category (most relevant) ────────────────────────────
    let subCatProducts = [];

    if (subCatId) {
      const subKey = `products:related:sub:${subCatId}:${lim}`;
      try {
        const cached = await redisClient.get(subKey);
        if (cached) {
          subCatProducts = JSON.parse(cached);
        } else {
          subCatProducts = await productModel.aggregate(
            buildPipeline(
              { subCategoryId: new mongoose.Types.ObjectId(subCatId) },
              lim * 3,
            ),
          );
          subCatProducts = subCatProducts.slice(0, lim);
          await redisClient.setex(subKey, 600, JSON.stringify(subCatProducts));
        }
      } catch (err) {
        console.error("[related] sub-category error:", err.message);
      }
    }

    // ── BUCKET 2: Category top-up (if quota not filled) ──────────────────
    let catProducts = [];
    const remaining = lim - subCatProducts.length;

    if (remaining > 0 && catId) {
      const alreadyIds = new Set(subCatProducts.map((p) => p._id.toString()));
      const catKey     = `products:related:cat:${catId}:${lim}`;

      try {
        const cached = await redisClient.get(catKey);
        if (cached) {
          catProducts = JSON.parse(cached);
        } else {
          catProducts = await productModel.aggregate(
            buildPipeline(
              {
                categoryId: new mongoose.Types.ObjectId(catId),
                // Don't overlap with sub-category bucket
                ...(subCatId && {
                  subCategoryId: { $ne: new mongoose.Types.ObjectId(subCatId) },
                }),
              },
              lim * 3,
            ),
          );
          catProducts = catProducts.slice(0, lim);
          await redisClient.setex(catKey, 600, JSON.stringify(catProducts));
        }
      } catch (err) {
        console.error("[related] category error:", err.message);
      }

      // Filter out duplicates already in bucket 1
      catProducts = catProducts
        .filter((p) => !alreadyIds.has(p._id.toString()))
        .slice(0, remaining);
    }

    return {
      products: [...subCatProducts, ...catProducts],
      meta: {
        fromSubCategory: subCatProducts.length,
        fromCategory:    catProducts.length,
        total:           subCatProducts.length + catProducts.length,
      },
    };
  }

  static async toggleTrending(productId, trendingValue) {
    const product = await productModel.findById(productId);
    if (!product) throw new AppError("Product not found", 404);

    const nextVal = typeof trendingValue === "boolean" ? trendingValue : !product.trending;
    
    product.trending = nextVal;
    await product.save();

    // Bust redis caches
    try {
      const keys = await redisClient.keys("products:trending:*");
      const homeKeys = await redisClient.keys("home:data:*");
      const allKeys = [`product:${productId}`, "products:list", ...keys, ...homeKeys];
      
      if (allKeys.length) {
        await redisClient.del(...allKeys);
      }
    } catch (err) {
      console.error("Failed to bust redis keys on trending toggle:", err.message);
    }

    return {
      _id: product._id,
      name: product.name,
      trending: product.trending,
    };
  }
}




