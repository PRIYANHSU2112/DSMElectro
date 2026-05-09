import hotDealModel from "../model/hotDeal.model.js";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import redisClient from "../config/redis.js";

export default class HotDealService {
  static async create(payload) {
    console.log("[HotDeal] Create payload:", payload);

    const deal = await hotDealModel.create(payload);

    const productIds = payload.products || [];
    const variantIds = payload.variants || [];
    const comboIds = payload.combos || [];

    console.log("[HotDeal] Products:", productIds.length);
    console.log("[HotDeal] Variants:", variantIds.length);

    // Product level
    if (productIds.length) {
      await Promise.all([
        productModel.updateMany(
          { _id: { $in: productIds } },
          { $set: { hotdeal: true } },
        ),
        variantModel.updateMany(
          { productId: { $in: productIds } },
          { $set: { hotDeal: true } },
        ),
      ]);
    }

    // Variant level
    if (variantIds.length) {
      await variantModel.updateMany(
        { _id: { $in: variantIds } },
        { $set: { hotDeal: true } },
      );
    }

    // ================= APPLY DISCOUNT (FINAL FIX) =================
    if (variantIds.length || productIds.length) {
      const variants = await variantModel.find({
        $or: [{ _id: { $in: variantIds } }, { productId: { $in: productIds } }],
      });

      const bulkOps = variants
        .map((v) => {
          if (!v.mrp || v.mrp <= 0) return null;

          let discountPercent = 0;
          let discountAmount = 0;

          if (payload.discountType === "percentage") {
            discountPercent = payload.discountValue;
            discountAmount = (v.mrp * discountPercent) / 100;
          } else {
            discountAmount = payload.discountValue;
            discountPercent = (discountAmount / v.mrp) * 100;
          }

          const finalPrice = v.mrp - discountAmount;

          return {
            updateOne: {
              filter: { _id: v._id },
              update: {
                $set: {
                  discount: Math.round(discountPercent),
                  discountAmount: Math.round(discountAmount),
                  finalPrice: Math.round(finalPrice),
                  hotDeal: true,
                },
              },
            },
          };
        })
        .filter(Boolean);

      if (bulkOps.length) {
        await variantModel.bulkWrite(bulkOps);
      }
    }

    // ✅ COMBO LEVEL (ADDED)
    if (comboIds.length) {
      const combos = await comboModel.find({ _id: { $in: comboIds } });

      const comboOps = combos.map((c) => {
        let discountAmount =
          payload.discountType === "percentage"
            ? (c.totalMrp * payload.discountValue) / 100
            : payload.discountValue;

        return {
          updateOne: {
            filter: { _id: c._id },
            update: {
              $set: {
                hotDeal: true,
                discount: payload.discountValue,
                discountAmount: Math.round(discountAmount),
                comboPrice: Math.round(c.totalMrp - discountAmount),
              },
            },
          },
        };
      });

      if (comboOps.length) {
        await comboModel.bulkWrite(comboOps);
      }
    }

    // =============================================================

    // Clear product cache
    const keys = await redisClient.keys("products:user:*");
    if (keys.length) {
      await redisClient.del(keys);
      console.log("[HotDeal] Redis cache cleared:", keys.length);
    }

    console.log("[HotDeal] Deal created successfully:", deal._id);

    return deal;
  }

  static async getActiveDeals() {
    const now = new Date();

    console.log("NOW:", now);

    const allDeals = await hotDealModel.find().lean();
    console.log("ALL DEALS:", allDeals);

    const deals = await hotDealModel
      .find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .populate("products")
      .populate("variants")
      .populate("combos")
      .lean();

    console.log("FILTERED DEALS:", deals);

    return deals;
  }
}
