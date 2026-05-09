import wishlistModel from "../model/wishlist.model.js";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import categoryModel from "../model/category.model.js";
import redisClient from "../config/redis.js";
import { AppError } from "../utils/apiResponse.js";

export default class WishlistService {
  // ADD TO WISHLIST
  static async addToWishlist(userId, payload) {
    const { product, variant } = payload;

    let productId = product;
    let category = null;

    //  VARIANT CASE
    if (variant) {
      const variantData = await variantModel.findById(variant);

      if (!variantData) {
        throw new AppError("Variant not found", 404);
      }

      // STOCK CHECK
      if (variantData.stock <= 0 || variantData.disable) {
        throw new AppError("Variant out of stock", 400);
      }

      productId = variantData.productId;
      category = variantData.category;
    }

    //  PRODUCT CASE
    else if (product) {
      const productData = await productModel.findById(product);

      if (!productData) {
        throw new AppError("Product not found", 404);
      }

      category = productData.categoryId;
    } else {
      throw new AppError("Product or Variant required", 400);
    }

    // DUPLICATE CHECK
    const exists = await wishlistModel.findOne({
      user: userId,
      product: productId,
      variant: variant || null,
    });

    if (exists) {
      throw new AppError("Already in wishlist", 400);
    }

    const item = await wishlistModel.create({
      user: userId,
      product: productId,
      variant: variant || null,
      category,
    });

    //  CLEAR REDIS CACHE
    await redisClient.del(`wishlist:${userId}`);

    return item;
  }

  // REMOVE
  static async removeFromWishlist(userId, payload) {
    const { product, variant } = payload;

    await wishlistModel.deleteOne({
      user: userId,
      product,
      variant: variant || null,
    });

    await redisClient.del(`wishlist:${userId}`);

    return true;
  }

  // GET WISHLIST (CATEGORY-WISE + REDIS)
  static async getWishlist(userId) {
    const cacheKey = `wishlist:${userId}`;

    //  CHECK CACHE
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await wishlistModel
      .find({ user: userId })
      .populate("product")
      .populate("variant")
      .populate("category")
      .lean();

    // GROUPING
    const grouped = {};

    for (const item of data) {
      const categoryName = item.category?.title || "Others";

      // STOCK CHECK
      let inStock = true;

      if (item.variant) {
        inStock = item.variant.stock > 0 && item.variant.disable === false;
      }

      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }

      grouped[categoryName].push({
        ...item,
        inStock,
      });
    }

    //
    await redisClient.setEx(cacheKey, 300, JSON.stringify(grouped));

    return grouped;
  }

  // GET WISHLIST BY USER ID (ADMIN)
  static async getWishlistByUser(userId) {
    const data = await wishlistModel
      .find({ user: userId, disable: false })
      .populate("product")
      .populate("variant")
      .populate("category")
      .lean();

    const grouped = {};

    for (const item of data) {
      const categoryName = item.category?.title || "Others";

      let inStock = true;

      if (item.variant) {
        inStock = item.variant.stock > 0 && item.variant.disable === false;
      }

      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }

      grouped[categoryName].push({
        ...item,
        inStock,
      });
    }

    return grouped;
  }

  static async toggleWishlistStatus(userId, payload) {
    const { product, variant } = payload;

    const item = await wishlistModel.findOne({
      user: userId,
      product,
      variant: variant || null,
    });

    if (!item) {
      throw new AppError("Wishlist item not found", 404);
    }

    item.disable = !item.disable;
    await item.save();

    await redisClient.del(`wishlist:${userId}`);

    return item;
  }
}
