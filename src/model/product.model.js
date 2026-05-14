import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },

    codeTab: {
      type: String,
    },

    slug: {
      type: String,
      lowercase: true,
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subCategory",
    },

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "brand",
    },

    description: { type: String },

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

    icon: {
      type: String,
      trim: true,
    },

    images: [
      {
        type: String,
        trim: true,
      },
    ],

    countries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "country",
      },
    ],

    states: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "state",
      },
    ],

    cities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "city",
      },
    ],

    pincodes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "pincode",
      },
    ],

    hotdeal: {
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

    trending: {
      type: Boolean,
      default: false,
    },

    analytics: {
      salesLast7Days: { type: Number, default: 0 },
      salesPrevious14Days: { type: Number, default: 0 },
      viewsLast7Days: { type: Number, default: 0 },
      viewsPrevious7Days: { type: Number, default: 0 },
      searchRank: { type: Number, default: 100 },
      previousSearchRank: { type: Number, default: 100 },
      cartAddsLast7Days: { type: Number, default: 0 },
      returnCountLast30Days: { type: Number, default: 0 },
    },

    discount: {
      type: Number,
    },

    discountAmount: {
      type: Number,
    },
    minDeliveryCharge: {
      air: { type: Number, default: 0 },
      road: { type: Number, default: 0 },
    },

    expectedDelivery: {
      type: Date,
    },

    returnInDays: {
      type: Number,
      default: 0, // 0 means not returnable
    },

    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalRatings: {
      type: Number,
      default: 0,
    },

    // Coins user earns when they buy this variant  (e.g. 50 coins)
    coinsReward: {
      type: Number,
      default: 0,
      min: 0,
    },

    // % of order amount that goes to the referrer's wallet when someone buys
    // this variant through a shared link  (set by admin, e.g. 5 = 5%)
    referralCommissionPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    disable: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true },
);

productSchema.index({ countries: 1 });
productSchema.index({ states: 1 });
productSchema.index({ cities: 1 });
productSchema.index({ pincodes: 1 });
productSchema.index({ name: "text", description: "text", sku: "text" });

const productModel = mongoose.model("product", productSchema);

export default productModel;
