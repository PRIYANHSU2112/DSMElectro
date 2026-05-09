import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    // ── variant item fields ──────────────────────────────
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      default: null,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "variant",
      default: null,
    },

    // ── combo item field ─────────────────────────────────
    comboId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "combo",
      default: null,
    },

    itemType: {
      type: String,
      enum: ["variant", "combo"],
      required: true,
      default: "variant",
    },

    quantity: { type: Number, default: 1, min: 1 },

    mrp: { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 },

    affiliateCode: {
      type: String,
      default: null,
    },

    // ✅ stored at add-time from variant's product or combo directly
    minDeliveryCharge: {
      air: { type: Number, default: 0 },
      road: { type: Number, default: 0 },
    },
  },
  { _id: true },
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      unique: true,
    },
    items: [cartItemSchema],
    appliedCoupon: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("cart", cartSchema);
