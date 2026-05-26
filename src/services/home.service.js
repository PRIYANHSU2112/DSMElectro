import mongoose from "mongoose";
import categoryModel from "../model/category.model.js";
import variantModel from "../model/variant.model.js";
import productModel from "../model/product.model.js";
import comboModel from "../model/combo.model.js";
import flashSaleModel from "../model/flashSale.model.js";
import FlashSaleService from "./flashSaleServices.js";
import redisClient from "../config/redis.js";

export default class HomeService {
  static async getHomePageData(query) {
    const { category, page, limit } = query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Cache key specific to requested page, limit and category
    const cacheKey = `home:data:cat_${category || "all"}:page_${pageNum}:limit_${limitNum}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Lazily clean up expired flash sales in the background
    try {
      const expiredSales = await flashSaleModel
        .find({ endDate: { $lt: new Date() }, isActive: true })
        .select("_id products variants combos")
        .lean();
      if (expiredSales.length) {
        FlashSaleService.deactivateSales(expiredSales).catch((err) =>
          console.error("[Lazy Cleanup] getHomePageData failed:", err.message)
        );
      }
    } catch (err) {
      console.error("[Lazy Cleanup] Home check failed:", err.message);
    }

    // Prepare Match Objects
    const variantMatchHot = { hotDeal: true, disable: false };
    const variantMatchFlash = { flashSale: true, disable: false };
    const variantMatchSpecial = { specialOffer: true, disable: false };
    const comboMatch = { disable: false };
    const productMatch = { disable: false };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      const catId = new mongoose.Types.ObjectId(category);
      variantMatchHot.category = catId;
      variantMatchFlash.category = catId;
      variantMatchSpecial.category = catId;
      comboMatch.categories = catId;
      productMatch.categoryId = catId;
    }

    // Prepare all queries simultaneously
    const categoriesPromise = categoryModel.find({ disable: false }).select("title icon banner").lean();
    
    const hotDealsPromise = variantModel
      .find(variantMatchHot)
      .populate("productId", "name avgRating totalRatings icon images slug categoryId subCategoryId brandId")
      .populate("category", "title")
      .populate("subCategory", "title")
      .limit(10)
      .lean();

    const flashSalePromise = variantModel
      .find(variantMatchFlash)
      .populate("productId", "name avgRating totalRatings icon images slug categoryId subCategoryId brandId")
      .populate("category", "title")
      .populate("subCategory", "title")
      .limit(10)
      .lean();

    const specialOffersPromise = variantModel
      .find(variantMatchSpecial)
      .populate("productId", "name avgRating totalRatings icon images slug categoryId subCategoryId brandId")
      .populate("category", "title")
      .populate("subCategory", "title")
      .limit(10)
      .lean();

    const newArrivalsPipeline = [
      { $match: productMatch },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "variants"
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryDoc"
        }
      },
      {
        $lookup: {
          from: "subcategories",
          localField: "subCategoryId",
          foreignField: "_id",
          as: "subCategoryDoc"
        }
      },
      {
        $project: {
          name: 1,
          avgRating: 1,
          totalRatings: 1,
          icon: 1,
          images: 1,
          slug: 1,
          categoryId: 1,
          subCategoryId: 1,
          brandId: 1,
          variantId: { $arrayElemAt: ["$variants._id", 0] },
          categoryName: { $arrayElemAt: ["$categoryDoc.title", 0] },
          subCategoryName: { $arrayElemAt: ["$subCategoryDoc.title", 0] },
          mrp: { $arrayElemAt: ["$variants.mrp", 0] },
          price: { $arrayElemAt: ["$variants.finalPrice", 0] },
          discount: { $arrayElemAt: ["$variants.discount", 0] }
        }
      }
    ];
    const newArrivalsPromise = productModel.aggregate(newArrivalsPipeline);

    const trendingProductsPipeline = [
      { $match: { ...productMatch, trending: true } },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "variants"
        }
      },
      { $match: { variants: { $not: { $size: 0 } } } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryDoc"
        }
      },
      {
        $lookup: {
          from: "subcategories",
          localField: "subCategoryId",
          foreignField: "_id",
          as: "subCategoryDoc"
        }
      },
      {
        $project: {
          name: 1,
          avgRating: 1,
          totalRatings: 1,
          icon: 1,
          images: 1,
          slug: 1,
          categoryId: 1,
          subCategoryId: 1,
          brandId: 1,
          variantId: { $arrayElemAt: ["$variants._id", 0] },
          categoryName: { $arrayElemAt: ["$categoryDoc.title", 0] },
          subCategoryName: { $arrayElemAt: ["$subCategoryDoc.title", 0] },
          mrp: { $arrayElemAt: ["$variants.mrp", 0] },
          price: { $arrayElemAt: ["$variants.finalPrice", 0] },
          discount: { $arrayElemAt: ["$variants.discount", 0] }
        }
      }
    ];
    const trendingProductsPromise = productModel.aggregate(trendingProductsPipeline);

    const combosPromise = comboModel
      .find(comboMatch)
      .select("name avgRating totalRatings icon images slug comboPrice totalMrp discount")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const productsPipeline = [
      { $match: productMatch },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryDoc"
        }
      },
      {
        $lookup: {
          from: "subcategories",
          localField: "subCategoryId",
          foreignField: "_id",
          as: "subCategoryDoc"
        }
      },
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "variants"
        }
      },
      { $match: { variants: { $not: { $size: 0 } } } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          avgRating: 1,
          totalRatings: 1,
          icon: 1,
          images: 1,
          slug: 1,
          categoryId: 1,
          subCategoryId: 1,
          brandId: 1,
          variantId: { $arrayElemAt: ["$variants._id", 0] },
          categoryName: { $arrayElemAt: ["$categoryDoc.title", 0] },
          subCategoryName: { $arrayElemAt: ["$subCategoryDoc.title", 0] },
          mrp: { $arrayElemAt: ["$variants.mrp", 0] },
          price: { $arrayElemAt: ["$variants.finalPrice", 0] },
          discount: { $arrayElemAt: ["$variants.discount", 0] }
        }
      }
    ];

    const productsPromise = productModel.aggregate(productsPipeline);
    const productsTotalPromise = productModel.countDocuments(productMatch);

    // Resolve all promises together to optimize IO wait times
    const [
      categories,
      hotDeals,
      flashSales,
      specialOffers,
      newArrivals,
      trendingProducts,
      combos,
      productsData,
      productsTotal
    ] = await Promise.all([
      categoriesPromise,
      hotDealsPromise,
      flashSalePromise,
      specialOffersPromise,
      newArrivalsPromise,
      trendingProductsPromise,
      combosPromise,
      productsPromise,
      productsTotalPromise
    ]);

    const formatVariantList = (list) => list.map(v => ({
      _id: v.productId?._id || v._id,
      variantId: v._id,
      name: v.productId?.name,
      avgRating: v.productId?.avgRating,
      totalRatings: v.productId?.totalRatings,
      icon: v.productId?.icon,
      images: v.productId?.images,
      slug: v.productId?.slug,
      categoryId: v.productId?.categoryId || v.category?._id,
      subCategoryId: v.productId?.subCategoryId || v.subCategory?._id,
      brandId: v.productId?.brandId || v.brand,
      categoryName: v.category?.title,
      subCategoryName: v.subCategory?.title,
      mrp: v.mrp,
      price: v.finalPrice,
      discount: v.discount
    })).filter(v => v.name);

    const responseData = {
      categories,
      hotDeals: formatVariantList(hotDeals),
      flashSales: formatVariantList(flashSales),
      specialOffers: formatVariantList(specialOffers),
      newArrivals,
      trendingProducts,
      combos,
      products: {
        data: productsData,
        pagination: {
          total: productsTotal,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(productsTotal / limitNum),
        }
      }
    };

    // Store in cache for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(responseData));

    return responseData;
  }
}
