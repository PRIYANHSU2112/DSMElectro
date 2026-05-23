import mongoose from "mongoose";

const membershipPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tier: {
      type: String,
      required: true,
      enum: ["silver", "gold", "platinum"],
      lowercase: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billing_cycle: {
      type: String,
      required: true,
      enum: ["monthly", "quarterly", "yearly"],
      lowercase: true,
    },
    discount_percent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    points_multiplier: {
      type: Number,
      default: 1.0,
      min: 0,
    },
    shipping_type: {
      type: String,
      default: "standard",
    },
    perks: {
      type: [String],
      default: [],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const MembershipPlan = mongoose.model("MembershipPlan", membershipPlanSchema);

export default MembershipPlan;
