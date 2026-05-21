import mongoose from "mongoose";

const affiliateTierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    minSales: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    benefits: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    themeColor: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

affiliateTierSchema.index({ minSales: 1 });
affiliateTierSchema.index({ isActive: 1 });
// Compound: supports findOne({ isActive, minSales: { $lte } }).sort({ minSales: -1 })
affiliateTierSchema.index({ isActive: 1, minSales: 1 });

export default mongoose.model("affiliateTier", affiliateTierSchema);
