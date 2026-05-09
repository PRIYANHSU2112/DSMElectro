import mongoose from "mongoose";

/**
 * WalletTransaction — every credit / debit to any wallet bucket.
 *
 * type  : what caused it
 * bucket: which bucket was affected  (balance | coins | referralBalance)
 */

export const WalletTxType = {
  TOPUP: "TOPUP",                         // user added money manually
  COIN_EARNED: "COIN_EARNED",             // coins earned after purchase
  COIN_REDEEMED: "COIN_REDEEMED",         // coins converted → Rs during checkout
  REFERRAL_EARNED: "REFERRAL_EARNED",     // commission when referred friend buys
  REFERRAL_REDEEMED: "REFERRAL_REDEEMED", // referral balance used at checkout
  WALLET_PAID: "WALLET_PAID",             // full wallet used at checkout
  WALLET_PARTIAL: "WALLET_PARTIAL",       // partial wallet used (rest online)
  REFUND: "REFUND",                       // order refund credited back
  ADMIN_CREDIT: "ADMIN_CREDIT",           // manual credit by admin
  ADMIN_DEBIT: "ADMIN_DEBIT",             // manual debit by admin
};

export const WalletBucket = {
  BALANCE: "balance",
  COINS: "coins",
  REFERRAL: "referralBalance",
};

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(WalletTxType),
      required: true,
    },

    bucket: {
      type: String,
      enum: Object.values(WalletBucket),
      required: true,
    },

    amount: {
      type: Number,
      required: true, // always positive; direction determined by `credit`
    },

    credit: {
      type: Boolean,
      required: true, // true = money coming in, false = going out
    },

    // ── Context references ──
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      default: null,
    },

    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    description: {
      type: String,
      trim: true,
    },

    // snapshot for audit
    balanceAfter: {
      type: Number,
    },
  },
  { timestamps: true },
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });

export default mongoose.model("walletTransaction", walletTransactionSchema);