import couponModel from "../model/coupon.model.js";
import couponUsageModel from "../model/couponUsage.model.js";
import { AppError } from "../utils/apiResponse.js";
import { validateCouponRules, calculateCouponDiscount } from "../utils/couponCalculator.js";

export default class CouponService {
  // CREATE
  static async createCoupon(payload) {
    const existing = await couponModel.findOne({ code: payload.code.toUpperCase() });
    if (existing) throw new AppError("Coupon code already exists", 409);

    return await couponModel.create(payload);
  }

  // GET ALL (Admin)
  static async getAllCoupons(query = {}) {
    return await couponModel.find(query).sort({ createdAt: -1 });
  }

  // GET BY CODEc (Validation)
  static async validateAndGetCoupon(code, userId, cartTotal) {
    const coupon = await couponModel.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!coupon) throw new AppError("Invalid coupon code", 404);

    // Check how many times this user has used this specific coupon
    const userUsageCount = await couponUsageModel.countDocuments({
      couponId: coupon._id,
      userId: userId
    });

    const { isValid, message } = validateCouponRules(coupon, userUsageCount);
    if (!isValid) throw new AppError(message, 400);

    if (coupon.minPurchaseAmount && cartTotal < coupon.minPurchaseAmount) {
      throw new AppError(`Minimum purchase of ₹${coupon.minPurchaseAmount} required for this coupon`, 400);
    }

    const discountAmount = calculateCouponDiscount(coupon, cartTotal);

    return {
      coupon,
      discountAmount,
      finalAmount: cartTotal - discountAmount
    };
  }

  // UPDATE
  static async updateCoupon(id, payload) {
    const coupon = await couponModel.findByIdAndUpdate(id, payload, { new: true });
    if (!coupon) throw new AppError("Coupon not found", 404);
    return coupon;
  }

  // DELETE
  static async deleteCoupon(id) {
    const coupon = await couponModel.findByIdAndDelete(id);
    if (!coupon) throw new AppError("Coupon not found", 404);
    return true;
  }

  // RECORD USAGE
  static async recordUsage(couponId, userId, orderId, discountAmount) {
    // 1. Increment global usage count in Coupon model
    await couponModel.findByIdAndUpdate(couponId, {
      $inc: { usedCount: 1 }
    });

    // 2. Create a usage record in CouponUsage collection
    await couponUsageModel.create({
      couponId,
      userId,
      orderId,
      discountAmount
    });
  }
}
