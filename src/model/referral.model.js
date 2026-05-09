import mongoose from "mongoose";

/**
 * Referral link tracking.
 *
 * Flow:
 *  1. User A calls /referral/link?productId=xxx  → gets a unique referral link
 *  2. User B opens that link → productId + referrerId stored in their session/cookie
 *  3. User B purchases → OrderService checks referral → credits User A's referralBalance
 *
 * A referral record is created once and can be reused (one link per sharer+product).
 * Each successful purchase creates a ReferralUse sub-document for audit.
 */

const referralUseSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
    },
    orderAmount: { type: Number, required: true },
    commissionPercent: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    creditedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const referralSchema = new mongoose.Schema(
  {
    // who shared the link
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    // what was shared (product OR combo — one of these)
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      default: null,
    },
    comboId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "combo",
      default: null,
    },

    // short token embedded in the share URL  e.g. /product/slug?ref=TOKEN
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // commission % set by admin on the product/variant/combo
    // stored here at link-creation time so later changes don't retro-affect old links
    commissionPercent: {
      type: Number,
      required: true,
      default: 0,
    },

    uses: [referralUseSchema],
  },
  { timestamps: true },
);

// one sharer can have one link per product and one per combo
referralSchema.index({ referrerId: 1, productId: 1 }, { sparse: true });
referralSchema.index({ referrerId: 1, comboId: 1 }, { sparse: true });

export default mongoose.model("referral", referralSchema);
