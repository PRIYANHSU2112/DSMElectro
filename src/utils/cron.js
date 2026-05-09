import cron from "node-cron";
import hotDealModel from "../model/hotDeal.model.js";
import SpecialOffer from "../model/specialOffer.model.js";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import redisClient from "../config/redis.js";

cron.schedule("*/2 * * * *", async () => {
  const now = new Date();

  console.log(`[CRON] Job started at ${now.toISOString()}`);

  try {

    // =================== HOT DEAL ===================

    const expiredDeals = await hotDealModel
      .find({ endDate: { $lt: now }, isActive: true })
      .lean();

    if (expiredDeals.length) {
      console.log(`[CRON] Expired hot deals found: ${expiredDeals.length}`);

      const productIds = new Set();
      const variantIds = new Set();

      expiredDeals.forEach((deal) => {
        deal.products?.forEach((id) => productIds.add(id.toString()));
        deal.variants?.forEach((id) => variantIds.add(id.toString()));
      });

      const stillActiveDeals = await hotDealModel
        .find({
          isActive: true,
          endDate: { $gte: now },
          $or: [
            { products: { $in: [...productIds] } },
            { variants: { $in: [...variantIds] } },
          ],
        })
        .lean();

      const activeProductIds = new Set();
      const activeVariantIds = new Set();

      stillActiveDeals.forEach((deal) => {
        deal.products?.forEach((id) => activeProductIds.add(id.toString()));
        deal.variants?.forEach((id) => activeVariantIds.add(id.toString()));
      });

      const finalProductIds = [...productIds].filter((id) => !activeProductIds.has(id));
      const finalVariantIds = [...variantIds].filter((id) => !activeVariantIds.has(id));

      const productVariants = await variantModel.find({ productId: { $in: finalProductIds } });
      const productResetOps = productVariants.map((v) => ({
        updateOne: {
          filter: { _id: v._id },
          update: { $set: { hotDeal: false, discount: 0, discountAmount: 0, finalPrice: v.mrp } },
        },
      }));

      const variantsToReset = await variantModel.find({ _id: { $in: finalVariantIds } });
      const variantResetOps = variantsToReset.map((v) => ({
        updateOne: {
          filter: { _id: v._id },
          update: { $set: { hotDeal: false, discount: 0, discountAmount: 0, finalPrice: v.mrp } },
        },
      }));

      if (productResetOps.length) await variantModel.bulkWrite(productResetOps);
      if (variantResetOps.length) await variantModel.bulkWrite(variantResetOps);

      await Promise.all([
        productModel.updateMany(
          { _id: { $in: finalProductIds } },
          { $set: { hotdeal: false } },
        ),
        hotDealModel.updateMany(
          { _id: { $in: expiredDeals.map((d) => d._id) } },
          { $set: { isActive: false } },
        ),
      ]);

      console.log("[CRON] HotDeal updates completed");
    } else {
      console.log("[CRON] No expired hot deals found");
    }

    // =================== SPECIAL OFFER ===================

    const expiredOffers = await SpecialOffer
      .find({ endDate: { $lt: now }, isActive: true })
      .lean();

    if (expiredOffers.length) {
      console.log(`[CRON] Expired special offers found: ${expiredOffers.length}`);

      const soProductIds = new Set();
      const soVariantIds = new Set();

      expiredOffers.forEach((offer) => {
        offer.products?.forEach((id) => soProductIds.add(id.toString()));
        offer.variants?.forEach((id) => soVariantIds.add(id.toString()));
      });

      const stillActiveOffers = await SpecialOffer.find({
        isActive: true,
        endDate: { $gte: now },
        $or: [
          { products: { $in: [...soProductIds] } },
          { variants: { $in: [...soVariantIds] } },
        ],
      }).lean();

      const activeSOProductIds = new Set();
      const activeSOVariantIds = new Set();

      stillActiveOffers.forEach((offer) => {
        offer.products?.forEach((id) => activeSOProductIds.add(id.toString()));
        offer.variants?.forEach((id) => activeSOVariantIds.add(id.toString()));
      });

      const finalSOProductIds = [...soProductIds].filter((id) => !activeSOProductIds.has(id));
      const finalSOVariantIds = [...soVariantIds].filter((id) => !activeSOVariantIds.has(id));

      const soProductVariants = await variantModel.find({ productId: { $in: finalSOProductIds } });
      const soProductResetOps = soProductVariants.map((v) => ({
        updateOne: {
          filter: { _id: v._id },
          update: { $set: { specialOffer: false, discount: null, discountAmount: 0, finalPrice: v.mrp } },
        },
      }));

      const soVariantsToReset = await variantModel.find({ _id: { $in: finalSOVariantIds } });
      const soVariantResetOps = soVariantsToReset.map((v) => ({
        updateOne: {
          filter: { _id: v._id },
          update: { $set: { specialOffer: false, discount: null, discountAmount: 0, finalPrice: v.mrp } },
        },
      }));

      if (soProductResetOps.length) await variantModel.bulkWrite(soProductResetOps);
      if (soVariantResetOps.length) await variantModel.bulkWrite(soVariantResetOps);

      await Promise.all([
        productModel.updateMany(
          { _id: { $in: finalSOProductIds } },
          { $set: { specialOffer: false, discount: null } },
        ),
        SpecialOffer.updateMany(
          { _id: { $in: expiredOffers.map((o) => o._id) } },
          { $set: { isActive: false } },
        ),
      ]);

      console.log("[CRON] SpecialOffer updates completed");
    } else {
      console.log("[CRON] No expired special offers found");
    }

    // =================== CLEAR REDIS ===================

    const keys = await redisClient.keys("products:user:*");
    if (keys.length) {
      await redisClient.del(keys);
      console.log(`[CRON] Redis cache cleared: ${keys.length} keys`);
    } else {
      console.log("[CRON] No Redis keys found to clear");
    }

    console.log(`[CRON] Job completed successfully at ${new Date().toISOString()}`);

  } catch (err) {
    console.error("[CRON ERROR]:", err.message);
  }
});