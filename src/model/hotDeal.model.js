import mongoose from "mongoose";

const hotDealSchema = new mongoose.Schema(
  {
    title: String,

    type: {
      type: String,
      enum: ["product", "variant", "combo", "both", "all"],
      required: true,
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
      },
    ],

    variants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "variant",
      },
    ],

    combos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "combo",
      },
    ],

    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

hotDealSchema.index({ startDate: 1, endDate: 1 });
hotDealSchema.index({ products: 1 });
hotDealSchema.index({ variants: 1 });
hotDealSchema.index({ combos: 1 });

export default mongoose.model("hotDeal", hotDealSchema);
