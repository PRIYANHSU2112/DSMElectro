import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "coupon",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes for fast lookups
couponUsageSchema.index({ couponId: 1, userId: 1 });
couponUsageSchema.index({ orderId: 1 });

const couponUsageModel = mongoose.model("couponUsage", couponUsageSchema);

export default couponUsageModel;
