import mongoose from "mongoose";

const userMembershipSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPlan",
      required: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    expiry_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "expired", "cancelled"],
      default: "active",
      lowercase: true,
    },
    coupon_code: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Indexes for performance
userMembershipSchema.index({ user_id: 1, status: 1 });
userMembershipSchema.index({ expiry_date: 1 });

const UserMembership = mongoose.model("UserMembership", userMembershipSchema);

export default UserMembership;
