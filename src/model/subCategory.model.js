// model/subCategory.model.js

import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    icon: {
      type: String,
      default: null,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    disable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

subCategorySchema.index({ title: 1, category: 1 }, { unique: true });
subCategorySchema.index({ title: "text" });

const subCategoryModel = mongoose.model("subCategory", subCategorySchema);
export default subCategoryModel;