// models/specialOffer.model.js
import mongoose from "mongoose";

const specialOfferSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],
    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "variant" }],
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

    discountValue: { type: Number, required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

specialOfferSchema.index({ startDate: 1, endDate: 1 });
specialOfferSchema.index({ products: 1 });
specialOfferSchema.index({ variants: 1 });
specialOfferSchema.index({ combos: 1 });

export default mongoose.model("specialOffer", specialOfferSchema);
