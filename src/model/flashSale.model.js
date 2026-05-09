import mongoose from "mongoose";

const flashSaleSchema = new mongoose.Schema(
  {
    title: String,

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],
    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "variant" }],
    combos: [{ type: mongoose.Schema.Types.ObjectId, ref: "combo" }],

    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },

    discountValue: Number,

    startDate: Date,
    endDate: Date,

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

flashSaleSchema.index({ startDate: 1, endDate: 1 });
flashSaleSchema.index({ products: 1 });
flashSaleSchema.index({ variants: 1 });
flashSaleSchema.index({ combos: 1 });

export default mongoose.model("flashSale", flashSaleSchema);