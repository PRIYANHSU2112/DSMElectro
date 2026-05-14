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

    // PRODUCT - Check for existing flash sale
    if (productIds.length) {
      const alreadyInSale = await productModel.findOne({ _id: { $in: productIds }, flashSale: true });
      if (alreadyInSale) throw new AppError(`Product ${alreadyInSale.name || alreadyInSale._id} is already in another active flash sale`, 400);

      await productModel.updateMany(
        { _id: { $in: productIds } },
        { flashSale: true }
      );
    }

    // VARIANT - Check for existing flash sale
    if (variantIds.length) {
      const alreadyInSale = await variantModel.findOne({ _id: { $in: variantIds }, flashSale: true });
      if (alreadyInSale) throw new AppError("One or more variants are already in another active flash sale", 400);

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

  static async addItems(saleId, payload) {
    const { products = [], variants = [], combos = [] } = payload;
    const sale = await flashSaleModel.findById(saleId);
    if (!sale) throw new AppError("Flash sale not found", 404);

    const existingProducts = sale.products.map((p) => p.toString());
    const existingVariants = sale.variants.map((v) => v.toString());
    const existingCombos = sale.combos.map((c) => c.toString());

    // Filter out duplicates
    const newProducts = products.filter((id) => !existingProducts.includes(id));
    const newVariants = variants.filter((id) => !existingVariants.includes(id));
    const newCombos = combos.filter((id) => !existingCombos.includes(id));

    if (newProducts.length) {
      const alreadyInSale = await productModel.findOne({ _id: { $in: newProducts }, flashSale: true });
      if (alreadyInSale) throw new AppError(`Product ${alreadyInSale.name || alreadyInSale._id} is already in another active flash sale`, 400);

      sale.products.push(...newProducts);
      await productModel.updateMany({ _id: { $in: newProducts } }, { flashSale: true });
    }

    if (newVariants.length) {
      const alreadyInSale = await variantModel.findOne({ _id: { $in: newVariants }, flashSale: true });
      if (alreadyInSale) throw new AppError("One or more variants are already in another active flash sale", 400);

      sale.variants.push(...newVariants);
      await variantModel.updateMany({ _id: { $in: newVariants } }, { flashSale: true });
    }

    if (newCombos.length) {
      const alreadyInSale = await comboModel.findOne({ _id: { $in: newCombos }, flashSale: true });
      if (alreadyInSale) throw new AppError("One or more combos are already in another active flash sale", 400);

      sale.combos.push(...newCombos);
      const combosData = await comboModel.find({ _id: { $in: newCombos } });
      const comboOps = combosData.map((c) => {
        let discountAmount =
          sale.discountType === "percentage"
            ? (c.totalMrp * sale.discountValue) / 100
            : sale.discountValue;

        return {
          updateOne: {
            filter: { _id: c._id },
            update: {
              flashSale: true,
              discount: sale.discountValue,
              discountAmount,
              comboPrice: c.totalMrp - discountAmount,
            },
          },
        };
      });
      if (comboOps.length) await comboModel.bulkWrite(comboOps);
    }

    await sale.save();
    return sale;
  }
}