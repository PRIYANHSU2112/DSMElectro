// models/videoGallery.model.js
import mongoose from "mongoose";

const videoGallerySchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
    },

    title: String,
    description: String,
    duration: Number,

    video: {
      url: String,
      key: String,
    },

    // ✅ NEW
    views: {
      type: Number,
      default: 0,
    },

    viewedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

videoGallerySchema.index({ categoryId: 1, subCategoryId: 1 });

export default mongoose.model("VideoGallery", videoGallerySchema);
