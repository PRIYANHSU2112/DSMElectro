import mongoose from "mongoose";

const comboSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      trim: true,
    },

    codeTab: {
      type: [String],
    },

    slug: {
      type: String,
      lowercase: true,
      index: true,
    },

    description: String,

    keyFeatures: [
      {
        title: String,
        points: [String],
      },
    ],

    specification: [
      {
        title: String,
        points: [String],
      },
    ],

    applications: [String],

    pinConfiguration: [String], // ✅ added

    icon: {
      type: String,
      trim: true,
    },

    banner: {
      type: String,
      trim: true,
    },

    images: [
      {
        type: String,
        trim: true,
      },
    ],

    weight: {
      value: Number,
      unit: {
        type: String,
        enum: ["g", "kg", "lb"],
        default: "kg",
      },
    },

    // 🔥 CORE COMBO PART
    items: [
      {
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "variant",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subCategory",
      },
    ],

    totalMrp: Number,
    comboPrice: Number,
    discount: Number,
    discountAmount: Number,

    stock: {
      type: Number,
      default: 0,
    },

    disable: {
      type: Boolean,
      default: false,
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

    returnInDays: {
      type: Number,
      default: 0,
    },

    minDeliveryCharge: {
      air: { type: Number, default: 0 },
      road: { type: Number, default: 0 },
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

    countries: [{ type: mongoose.Schema.Types.ObjectId, ref: "country" }],
    states: [{ type: mongoose.Schema.Types.ObjectId, ref: "state" }],
    cities: [{ type: mongoose.Schema.Types.ObjectId, ref: "city" }],
    pincodes: [{ type: mongoose.Schema.Types.ObjectId, ref: "pincode" }],
  },
  { timestamps: true },
);

comboSchema.index({ "items.variantId": 1 });
comboSchema.index({ createdAt: -1 });
comboSchema.index({ name: "text", description: "text", sku: "text" });

export default mongoose.model("combo", comboSchema);
