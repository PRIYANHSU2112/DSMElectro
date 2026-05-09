import cartModel from "../model/cart.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import productModel from "../model/product.model.js";
import { AppError } from "../utils/apiResponse.js";
import mongoose from "mongoose";
import { calculateCartSummary } from "../utils/cartCalculator.js";
import redisClient from "../config/redis.js";
import couponModel from "../model/coupon.model.js";
import CouponService from "./couponServices.js";
import logger from "../utils/logger.js";

export default class CartService {
  // ─── ADD TO CART ─────────────────────────────────────────────
  static async addToCart(userId, items) {
    if (!Array.isArray(items)) items = [items];

    let cart = await cartModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, items: [] } },
      { new: true, upsert: true },
    );

    const failed = [];

    for (const item of items) {
      try {
        const { variantId, comboId, quantity = 1, affiliateCode } = item;

        // ── COMBO ──────────────────────────────────────
        if (comboId) {
          if (!mongoose.Types.ObjectId.isValid(comboId))
            throw new Error("Invalid comboId");

          const combo = await comboModel.findById(comboId).lean();

          if (!combo || combo.disable) throw new Error("Combo not available");

          if (!combo.stock || combo.stock < quantity)
            throw new Error("Insufficient combo stock");

          // ✅ UPDATED (multi-affiliate aware)
          const existingIdx = cart.items.findIndex(
            (i) =>
              i.comboId?.toString() === comboId &&
              i.itemType === "combo" &&
              (i.affiliateCode || null) === (affiliateCode || null),
          );

          const minDeliveryCharge = {
            air: combo.minDeliveryCharge?.air ?? 0,
            road: combo.minDeliveryCharge?.road ?? 0,
          };

          if (existingIdx > -1) {
            const newQty = cart.items[existingIdx].quantity + quantity;
            if (combo.stock < newQty) throw new Error("Stock exceeded");

            cart.items[existingIdx].quantity = newQty;
            cart.items[existingIdx].mrp = combo.totalMrp;
            cart.items[existingIdx].finalPrice = combo.comboPrice;
            cart.items[existingIdx].minDeliveryCharge = minDeliveryCharge;
          } else {
            cart.items.push({
              comboId,
              itemType: "combo",
              quantity,
              mrp: combo.totalMrp,
              finalPrice: combo.comboPrice,
              minDeliveryCharge,
              affiliateCode: affiliateCode || null, // ✅ ADDED
            });
          }

          // ── VARIANT ────────────────────────────────────
        } else if (variantId) {
          if (!mongoose.Types.ObjectId.isValid(variantId))
            throw new Error("Invalid variantId");

          const variant = await variantModel.findById(variantId).lean();

          if (!variant || variant.disable)
            throw new Error("Variant not available");

          if (!variant.stock || variant.stock < quantity)
            throw new Error("Insufficient stock");

          const product = await productModel
            .findById(variant.productId)
            .select("minDeliveryCharge")
            .lean();

          const minDeliveryCharge = {
            air: product?.minDeliveryCharge?.air ?? 0,
            road: product?.minDeliveryCharge?.road ?? 0,
          };

          const discount = variant.discount || 0;
          const finalPrice =
            discount > 0
              ? variant.mrp - (variant.mrp * discount) / 100
              : variant.mrp;

          // ✅ UPDATED (multi-affiliate aware)
          const existingIdx = cart.items.findIndex(
            (i) =>
              i.variantId?.toString() === variantId &&
              i.itemType === "variant" &&
              (i.affiliateCode || null) === (affiliateCode || null),
          );

          if (existingIdx > -1) {
            const newQty = cart.items[existingIdx].quantity + quantity;
            if (variant.stock < newQty) throw new Error("Stock exceeded");

            cart.items[existingIdx].quantity = newQty;
            cart.items[existingIdx].finalPrice = finalPrice;
            cart.items[existingIdx].minDeliveryCharge = minDeliveryCharge;
          } else {
            cart.items.push({
              productId: variant.productId,
              variantId,
              itemType: "variant",
              quantity,
              mrp: variant.mrp,
              finalPrice,
              minDeliveryCharge,
              affiliateCode: affiliateCode || null, // ✅ ADDED
            });
          }
        } else {
          throw new Error("Must provide variantId or comboId");
        }
      } catch (err) {
        failed.push({
          variantId: item.variantId ?? null,
          comboId: item.comboId ?? null,
          reason: err.message,
        });
      }
    }

    await cart.save();
    await CartService._clearCartCache(userId);

    return { success: true, failed };
  }

  // ─── GET CART ─────────────────────────────────────────────────
  static async getCart(userId) {
    const cacheKey = `cart:${userId}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
    console.log("Cart not found in cache");

    console.log(userId)
    const cart = await cartModel
      .findOne({ userId })
      .populate("items.productId")
      .populate("items.variantId")
      .populate({
        path: "items.comboId",
        model: "combo",
      })
      .lean();

    if (!cart) return { cartId: null, items: [], summary: null };

    // Fetch applied coupon details if exists
    let coupon = null;
    if (cart.appliedCoupon) {
      coupon = await couponModel.findOne({
        code: cart.appliedCoupon,
        isActive: true
      }).lean();
    }

    const summary = calculateCartSummary(cart.items, coupon);

    const result = {
      cartId: cart._id,
      appliedCoupon: cart.appliedCoupon,
      ...summary,
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    return result;
  }

  // ─── APPLY COUPON ─────────────────────────────────────────────
  static async applyCoupon(userId, code) {
    const cart = await cartModel.findOne({ userId });
    if (!cart) throw new AppError("Cart not found", 404);

    if (!cart.items.length) throw new AppError("Cannot apply coupon to an empty cart", 400);

    // Calculate total based on items (ignoring stock for validation)
    const cartTotal = cart.items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);

    // Validate coupon using the service
    const { coupon } = await CouponService.validateAndGetCoupon(code, userId, cartTotal);

    // Save to cart
    cart.appliedCoupon = coupon.code;
    await cart.save();
    await CartService._clearCartCache(userId);

    return {
      message: "Coupon applied successfully",
      couponCode: coupon.code
    };
  }

  // ─── REMOVE COUPON ────────────────────────────────────────────
  static async removeCoupon(userId) {
    const cart = await cartModel.findOne({ userId });
    if (!cart) throw new AppError("Cart not found", 404);

    cart.appliedCoupon = null;
    await cart.save();
    await CartService._clearCartCache(userId);

    return { message: "Coupon removed successfully" };
  }


  // ─── UPDATE ITEM QTY ──────────────────────────────────────────
  static async updateCartItem(userId, itemId, quantity) {
    const cart = await cartModel.findOne({ userId });
    if (!cart) throw new AppError("Cart not found", 404);

    const item = cart.items.id(itemId);
    if (!item) throw new AppError("Cart item not found", 404);

    if (item.itemType === "combo") {
      const combo = await comboModel.findById(item.comboId);
      if (!combo || combo.disable)
        throw new AppError("Combo not available", 400);
      if (combo.stock < quantity) throw new AppError("Stock exceeded", 400);
    } else {
      const variant = await variantModel.findById(item.variantId);
      if (!variant || variant.disable)
        throw new AppError("Variant not available", 400);
      if (variant.stock < quantity) throw new AppError("Stock exceeded", 400);
    }

    item.quantity = quantity;
    await cart.save();
    await CartService._clearCartCache(userId);

    return item;
  }

  // ─── REMOVE ITEM ──────────────────────────────────────────────
  static async removeItem(userId, itemId) {
    const cart = await cartModel.findOne({ userId });
    if (!cart) throw new AppError("Cart not found", 404);

    const item = cart.items.id(itemId);
    if (!item) throw new AppError("Cart item not found", 404);

    item.deleteOne();
    await cart.save();
    await CartService._clearCartCache(userId);
    return true;
  }

  // ─── DECREASE QTY ─────────────────────────────────────────────
  static async decreaseQuantity(userId, itemId) {
    const cart = await cartModel.findOne({ userId });
    if (!cart) throw new AppError("Cart not found", 404);

    const item = cart.items.id(itemId);
    if (!item) throw new AppError("Cart item not found", 404);

    if (item.quantity > 1) {
      item.quantity -= 1;
    } else {
      item.deleteOne();
    }

    await cart.save();
    await CartService._clearCartCache(userId);
    return item;
  }

  // ─── CLEAR CART ───────────────────────────────────────────────
  static async clearCart(userId) {
    await cartModel.deleteOne({ userId });
    await CartService._clearCartCache(userId);
    return true;
  }

  // ─── CACHE HELPER ─────────────────────────────────────────────
  static async _clearCartCache(userId) {
    await redisClient.del(`cart:${userId}`);
    await redisClient.del(`products:related:cart:${userId}`);
  }
}
