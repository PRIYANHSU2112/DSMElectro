import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "brand",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subCategory",
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
    },
    mrp: {
      type: Number,
    },

    stock: {
      type: Number,
    },
    sold: {
      type: Boolean,
      default: false,
    },

    disable: {
      type: Boolean,
      default: false,
    },

    weight: {
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        enum: ["g", "kg", "lb"],
        default: "kg",
      },
    },

    size: {
      type: String,
    },

    discount: {
      type: Number,
      min: 0,
      index: true,
    },

    packageDimensions: {
      type: String,
    },

    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },
    hotDeal: {
      type: Boolean,
      default: false,
    },

    specialOffer: {
      type: Boolean,
      default: false,
    },

    flashSale: {
      type: Boolean,
      default: false,
    },

    finalPrice: {
      type: Number,
    },

    coinsReward: {
      type: Number,
      default: 0,
      min: 0,
    },

    referralCommissionPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

variantSchema.index({ productId: 1 });
variantSchema.index({ category: 1 });
variantSchema.index({ brand: 1 });
variantSchema.index({ subCategory: 1 });
variantSchema.index({ createdAt: -1 });
variantSchema.index({ disable: 1 });

const variantModel = mongoose.model("variant", variantSchema);

export default variantModel;
