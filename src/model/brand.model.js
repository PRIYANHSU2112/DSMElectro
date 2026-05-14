import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      trim: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subCategory",
    },

    icon: {
      type: String,
      trim: true,
    },
    disable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

brandSchema.index({ brandName: "text" });

const brandModel = mongoose.model("brand", brandSchema);

export default brandModel;
