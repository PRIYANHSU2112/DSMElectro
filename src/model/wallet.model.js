import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },

    // ── Main wallet balance (from top-up or cashback) ──
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Coins earned from purchases (10 coins = 1 Rs) ──
    coins: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Referral earnings (separate bucket) ──
    referralBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Conversion rate: how many coins = 1 Rs (admin configurable) ──
    coinConversionRate: {
      type: Number,
      default: 10, // 10 coins = 1 Rs
    },
  },
  { timestamps: true },
);

export default mongoose.model("wallet", walletSchema);