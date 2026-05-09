import crypto from "crypto";
import referralModel from "../model/referral.model.js";
import productModel from "../model/product.model.js";
import comboModel from "../model/combo.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class ReferralService {
  /**
   * Generate (or return existing) referral link token for a user + product/combo.
   *
   * Usage: GET /referral/link?productId=xxx  OR  ?comboId=xxx
   * Returns: { token, url }
   * Frontend builds the full URL like:
   *   https://yourapp.com/products/<slug>?ref=<token>
   */
  static async getOrCreateLink(referrerId, { productId, comboId }) {
    if (!productId && !comboId) {
      throw new AppError("Provide productId or comboId", 400);
    }

    // ── Find commission % from the item ──
    let commissionPercent = 0;

    if (productId) {
      const product = await productModel.findById(productId).lean();
      if (!product) throw new AppError("Product not found", 404);
      commissionPercent = product.referralCommissionPercent ?? 0;
    } else {
      const combo = await comboModel.findById(comboId).lean();
      if (!combo) throw new AppError("Combo not found", 404);
      commissionPercent = combo.referralCommissionPercent ?? 0;
    }

    // ── Re-use existing link if one exists ──
    const query = productId
      ? { referrerId, productId }
      : { referrerId, comboId };

    let referral = await referralModel.findOne(query).lean();

    if (!referral) {
      const token = crypto.randomBytes(8).toString("hex"); // 16-char token
      referral = await referralModel.create({
        referrerId,
        productId: productId ?? null,
        comboId: comboId ?? null,
        token,
        commissionPercent,
      });
    }

    return {
      token: referral.token,
      commissionPercent: referral.commissionPercent,
    };
  }

  /**
   * Resolve a ref token → referral document.
   * Called by OrderService before creating an order when req has a ref token.
   */
  static async resolveToken(token) {
    if (!token) return null;
    return referralModel.findOne({ token }).lean();
  }

  /**
   * Record a successful purchase against a referral.
   * Also used by OrderService — not needed to call separately.
   */
  static async recordUse(referralId, { buyerId, orderId, orderAmount, commissionPercent, commissionAmount }) {
    await referralModel.findByIdAndUpdate(referralId, {
      $push: {
        uses: { buyerId, orderId, orderAmount, commissionPercent, commissionAmount },
      },
    });
  }

  /**
   * Get all referral links created by a user (with stats).
   */
  static async getMyReferrals(userId) {
    return referralModel
      .find({ referrerId: userId })
      .populate("productId", "name slug icon")
      .populate("comboId", "name slug icon")
      .lean();
  }
}