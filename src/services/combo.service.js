import comboModel from "../model/combo.model.js";
import variantModel from "../model/variant.model.js";
import redisClient from "../config/redis.js";
import slugify from "slugify";
import mongoose from "mongoose";
import { AppError } from "../utils/apiResponse.js";

export default class ComboService {
  static async createCombo(payload) {
    const { items } = payload;

    let totalMrp = 0;
    let minStock = Infinity;
    const categorySet = new Set();
    const subCategorySet = new Set();


    for (const item of items) {
      const variant = await variantModel.findById(item.variantId);

      if (!variant || variant.disable) {
        throw new AppError("Invalid variant in combo", 400);
      }

      totalMrp += variant.mrp * item.quantity;


      const available = Math.floor(variant.stock / item.quantity);
      minStock = Math.min(minStock, available);

      if (variant.category) categorySet.add(variant.category.toString());
      if (variant.subCategory)
        subCategorySet.add(variant.subCategory.toString());
    }

    const combo = await comboModel.create({
      ...payload,
      slug: slugify(payload.name, { lower: true, strict: true }),
      totalMrp,
      discountAmount: totalMrp - payload.comboPrice,
      stock: minStock,
      categories: [...categorySet],
      subCategories: [...subCategorySet],
    });

    await redisClient.unlink("combos:list");

    return ComboService.getComboById(combo._id.toString());
  }

  // ─── LOOKUP STAGES ONLY (no $match / $sort — caller handles those) ───
  static _lookupStages() {
    return [
      // join variant details for each item
      {
        $lookup: {
          from: "variants",
          localField: "items.variantId",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "products",
                localField: "productId",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1, slug: 1, icon: 1 } }],
                as: "product",
              },
            },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                pipeline: [{ $project: { title: 1 } }],
                as: "category",
              },
            },
            {
              $unwind: { path: "$category", preserveNullAndEmptyArrays: true },
            },
            {
              $lookup: {
                from: "subcategories",
                localField: "subCategory",
                foreignField: "_id",
                pipeline: [{ $project: { title: 1 } }],
                as: "subCategory",
              },
            },
            {
              $unwind: {
                path: "$subCategory",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
          as: "_variants",
        },
      },
      // merge variant + productId + productName back into each item
      {
        $addFields: {
          items: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    variant: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$_variants",
                            cond: { $eq: ["$$this._id", "$$item.variantId"] },
                          },
                        },
                        0,
                      ],
                    },
                    productId: {
                      $let: {
                        vars: {
                          v: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$_variants",
                                  cond: {
                                    $eq: ["$$this._id", "$$item.variantId"],
                                  },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: "$$v.product._id",
                      },
                    },
                    productName: {
                      $let: {
                        vars: {
                          v: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$_variants",
                                  cond: {
                                    $eq: ["$$this._id", "$$item.variantId"],
                                  },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: "$$v.product.name",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unset: "_variants" },
      // resolve category names from combo.categories
      {
        $lookup: {
          from: "categories",
          localField: "categories",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, title: 1 } }],
          as: "categories",
        },
      },
      // resolve subCategory names from combo.subCategories
      {
        $lookup: {
          from: "subcategories",
          localField: "subCategories",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, title: 1 } }],
          as: "subCategories",
        },
      },
    ];
  }

  // ─── BUILD MATCH FROM QUERY FILTERS ───
  static buildMatch(filters) {
    const {
      search,
      category,
      subCategory,
      hotDeal,
      specialOffer,
      flashSale,
      status, // admin only
      city, // user only
      pincode, // user only
      baseMatch = {},
    } = filters;

    const match = { ...baseMatch };

    if (status === "enabled") match.disable = false;
    else if (status === "disabled") match.disable = true;

    if (search) match.name = { $regex: search, $options: "i" };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      match.categories = { $in: [new mongoose.Types.ObjectId(category)] };
    }

    if (subCategory && mongoose.Types.ObjectId.isValid(subCategory)) {
      match.subCategories = { $in: [new mongoose.Types.ObjectId(subCategory)] };
    }

    if (hotDeal === "true") match.hotDeal = true;
    if (specialOffer === "true") match.specialOffer = true;
    if (flashSale === "true") match.flashSale = true;

    if (city && mongoose.Types.ObjectId.isValid(city)) {
      match.cities = { $in: [new mongoose.Types.ObjectId(city)] };
    }

    if (pincode && mongoose.Types.ObjectId.isValid(pincode)) {
      match.pincodes = { $in: [new mongoose.Types.ObjectId(pincode)] };
    }

    return match;
  }

  // ─── SORT STAGE FROM QUERY ───
  static _buildSort(sort) {
    if (sort === "low") return { comboPrice: 1 };
    if (sort === "high") return { comboPrice: -1 };
    return { createdAt: -1 }; // default: newest first
  }

  // ─── FULL PIPELINE BUILDER ───
  static _buildPipeline(match, sort, { skip, limit } = {}) {
    const pipeline = [{ $match: match }, { $sort: sort }];

    if (skip !== undefined) pipeline.push({ $skip: skip });
    if (limit !== undefined) pipeline.push({ $limit: limit });

    pipeline.push(...ComboService._lookupStages());

    return pipeline;
  }

  static async getAllCombos(query) {
    const { page = 1, limit = 10, sort, ...filters } = query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const match = ComboService.buildMatch(filters);
    const sortObj = ComboService._buildSort(sort);

    const cacheKey = `combos:${JSON.stringify(query)}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [combos, total] = await Promise.all([
      comboModel.aggregate(
        ComboService._buildPipeline(match, sortObj, {
          skip,
          limit: parseInt(limit),
        }),
      ),
      comboModel.countDocuments(match),
    ]);

    const result = {
      combos,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    return result;
  }

  static async getAllCombosAdmin(query) {
    const { page, limit, sort, ...filters } = query;

    const match = ComboService.buildMatch(filters);
    const sortObj = ComboService._buildSort(sort);

    const cacheKey = `combos:admin:${JSON.stringify(query)}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let result;

    if (page && limit) {
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [combos, total] = await Promise.all([
        comboModel.aggregate(
          ComboService._buildPipeline(match, sortObj, {
            skip,
            limit: parseInt(limit),
          }),
        ),
        comboModel.countDocuments(match),
      ]);

      result = {
        combos,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      };
    } else {
      const combos = await comboModel.aggregate(
        ComboService._buildPipeline(match, sortObj),
      );
      result = { combos, total: combos.length };
    }

    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    return result;
  }

  static async getAllCombosUser(query) {
    const { page = 1, limit = 10, sort, ...filters } = query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const match = ComboService.buildMatch({
      ...filters,
      baseMatch: { disable: false },
    });
    const sortObj = ComboService._buildSort(sort);

    const cacheKey = `combos:user:${JSON.stringify(query)}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [combos, total] = await Promise.all([
      comboModel.aggregate(
        ComboService._buildPipeline(match, sortObj, {
          skip,
          limit: parseInt(limit),
        }),
      ),
      comboModel.countDocuments(match),
    ]);

    const result = {
      combos,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    return result;
  }

  static async getComboById(id) {
    const cacheKey = `combo:${id}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const pipeline = ComboService._buildPipeline(
      { _id: new mongoose.Types.ObjectId(id) },
      { createdAt: -1 },
    );

    const combos = await comboModel.aggregate(pipeline);
    const combo = combos[0];
    if (!combo) throw new AppError("Combo not found", 404);

    await redisClient.setEx(cacheKey, 300, JSON.stringify(combo));
    return combo;
  }

  static async updateCombo(id, payload) {
    const combo = await comboModel.findById(id);
    if (!combo) throw new AppError("Combo not found", 404);

    if (payload.items) {
      let totalMrp = 0;
      let minStock = Infinity;
      const categorySet = new Set();
      const subCategorySet = new Set();

      for (const item of payload.items) {
        const variant = await variantModel.findById(item.variantId);

        if (!variant || variant.disable) {
          throw new AppError("Invalid variant in combo", 400);
        }

        totalMrp += variant.mrp * item.quantity;

        const available = Math.floor(variant.stock / item.quantity);
        minStock = Math.min(minStock, available);

        if (variant.category) categorySet.add(variant.category.toString());
        if (variant.subCategory)
          subCategorySet.add(variant.subCategory.toString());
      }

      payload.totalMrp = totalMrp;
      payload.discountAmount = totalMrp - payload.comboPrice;
      payload.stock = minStock;
      payload.categories = [...categorySet];
      payload.subCategories = [...subCategorySet];
    }

    if (payload.name) {
      payload.slug = slugify(payload.name, { lower: true, strict: true });
    }

    await comboModel.findByIdAndUpdate(id, { $set: payload }, { new: true });

    await redisClient.del(`combo:${id}`);
    await redisClient.unlink("combos:list");

    return ComboService.getComboById(id);
  }

  static async deleteCombo(id) {
    const combo = await comboModel.findById(id);
    if (!combo) throw new AppError("Combo not found", 404);

    await combo.deleteOne();

    await redisClient.del(`combo:${id}`);
    await redisClient.unlink("combos:list");

    return true;
  }

  static async toggleDisableCombo(id) {
    const combo = await comboModel.findById(id);
    if (!combo) throw new AppError("Combo not found", 404);

    await comboModel.findByIdAndUpdate(
      id,
      { $set: { disable: !combo.disable } },
      { new: true },
    );

    await redisClient.del(`combo:${id}`);
    await redisClient.unlink("combos:list");

    return ComboService.getComboById(id);
  }
}
