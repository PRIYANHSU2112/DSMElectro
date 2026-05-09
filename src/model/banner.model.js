import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    image: { type: String },
    redirectUrl: { type: String, default: null },
    page: { type: String, index: true },
    position: { type: Number, min: 1 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bannerSchema.index({ page: 1, position: 1 });
bannerSchema.index({ isActive: 1, isDeleted: 1 });

export default mongoose.model("Banner", bannerSchema);
