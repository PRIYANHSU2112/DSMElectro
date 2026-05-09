import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      description: "Caps the discount for percentage-based coupons",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null,
      description: "Total number of times this coupon can be used globally",
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    userLimit: {
      type: Number,
      default: 1,
      description: "How many times a single user can use this coupon",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Optional: Restrict to specific items
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],
    applicableCombos: [{ type: mongoose.Schema.Types.ObjectId, ref: "combo" }],
    applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "category" }],
  },
  { timestamps: true },
);

// Indexes for performance
couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const couponModel = mongoose.model("coupon", couponSchema);

export default couponModel;
