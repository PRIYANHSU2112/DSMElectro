import mongoose from "mongoose";

const pointsLedgerSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    event_type: {
      type: String,
      required: true,
      enum: ["welcome_bonus", "purchase_earn", "redeem"],
      lowercase: true,
    },
    points: {
      type: Number,
      required: true,
    },
    earned_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Indexes for aggregating points balance quickly
pointsLedgerSchema.index({ user_id: 1, points: 1 });

const PointsLedger = mongoose.model("PointsLedger", pointsLedgerSchema);

export default PointsLedger;
