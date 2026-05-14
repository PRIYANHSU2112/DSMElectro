import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },

    disable: {
      type: Boolean,
      default: false,
    },

    icon: {
      type: String,
      default: false,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

categorySchema.index({ title: "text" });

const categoryModel = mongoose.model("Category", categorySchema);

export default categoryModel;
