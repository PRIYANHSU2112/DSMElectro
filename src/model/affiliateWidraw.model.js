import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "affiliate",
      required: true,
    },

    amount: { type: Number, required: true, min: 100 },

    // which method the affiliate chose
    method: {
      type: String,
      enum: ["upi", "bank", "dsm"],
      required: true,
    },

    // snapshot of payout details at time of request
    payoutDetails: {
      // UPI
      upiId: { type: String, default: null },

      // Bank
      accountNumber: { type: String, default: null },
      ifscCode: { type: String, default: null },
      accountHolder: { type: String, default: null },
      transferMode: { type: String, default: null }, // IMPS / NEFT / RTGS

      // DSM
      dsmUserId: { type: String, default: null },
      dsmCredits: { type: Number, default: null },
    },

    status: {
      type: String,
      enum: ["pending", "processing", "processed", "rejected"],
      default: "pending",
    },

    adminNote: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

withdrawalSchema.index({ affiliateId: 1, status: 1 });
withdrawalSchema.index({ affiliateId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("affiliateWithdrawal", withdrawalSchema);
