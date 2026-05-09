import flashSaleModel from "../model/flashSale.model.js";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import redisClient from "../config/redis.js";

export default class FlashSaleService {
  static async create(payload) {
    const productIds = payload.products || [];
    const variantIds = payload.variants || [];
    const comboIds = payload.combos || [];

    const sale = await flashSaleModel.create(payload);

    // PRODUCT
    if (productIds.length) {
      await productModel.updateMany(
        { _id: { $in: productIds } },
        { flashSale: true }
      );
    }

    // VARIANT
    if (variantIds.length) {
      await variantModel.updateMany(
        { _id: { $in: variantIds } },
        { flashSale: true }
      );
    }

    // COMBO ✅
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
              flashSale: true,
              discount: payload.discountValue,
              discountAmount,
              comboPrice: c.totalMrp - discountAmount,
            },
          },
        };
      });

      await comboModel.bulkWrite(comboOps);
    }

    // REDIS
    const keys = await redisClient.keys("products:user:*");
    if (keys.length) await redisClient.del(keys);

    return sale;
  }

  static async getActive() {
    const now = new Date();
    return flashSaleModel
      .find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .populate("products")
      .populate("variants")
      .populate("combos");
  }
}