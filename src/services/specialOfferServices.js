// services/specialOffer.service.js
import SpecialOffer from "../model/specialOffer.model.js";
import ProductModel from "../model/product.model.js";
import VariantModel from "../model/variant.model.js";
import HotDeal from "../model/hotDeal.model.js";
import comboModel from "../model/combo.model.js";

export default class SpecialOfferService {
  // ─── Calculate discount ───────────────────────────────────────────────────

  static calcDiscount(mrp, discountType, discountValue) {
    if (!mrp || mrp <= 0) return { discountAmount: 0, finalPrice: 0 };

    if (discountType === "percentage") {
      const discountAmount = parseFloat(
        ((mrp * discountValue) / 100).toFixed(2),
      );
      const finalPrice = parseFloat((mrp - discountAmount).toFixed(2));
      return { discountAmount, finalPrice };
    }

    // flat
    const discountAmount = discountValue;
    const finalPrice = parseFloat((mrp - discountValue).toFixed(2));
    return { discountAmount, finalPrice };
  }

  // ─── Conflict check ───────────────────────────────────────────────────────

  static async assertNoActiveConflict(
    productIds = [],
    variantIds = [],
    comboIds = [],
  ) {
    if (!productIds.length && !variantIds.length && !comboIds.length) return;

    const now = new Date();

    const orConditions = [
      ...(productIds.length ? [{ products: { $in: productIds } }] : []),
      ...(variantIds.length ? [{ variants: { $in: variantIds } }] : []),
      ...(comboIds.length ? [{ combos: { $in: comboIds } }] : []),
    ];

    // Check HotDeal conflict
    const conflictingHotDeal = await HotDeal.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: orConditions,
    }).select("title");

    if (conflictingHotDeal) {
      throw new Error(
        `One or more items are active in a Hot Deal "${conflictingHotDeal.title || "Untitled"}". Please remove that deal first.`,
      );
    }

    // Check existing SpecialOffer conflict
    const conflictingSpecial = await SpecialOffer.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: orConditions,
    }).select("title");

    if (conflictingSpecial) {
      throw new Error(
        `One or more items are already active in a Special Offer "${conflictingSpecial.title || "Untitled"}". Please remove that offer first.`,
      );
    }

    // ↓ Add more deal types here (FlashSale, etc.) following the same pattern
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  static async create(body) {
    const {
      title,
      products = [],
      variants = [],
      combos = [],
      discountType,
      discountValue,
      startDate,
      endDate,
    } = body;

    // 1. Conflict check on directly passed ids
    await SpecialOfferService.assertNoActiveConflict(products, variants, combos);

    // 1a. Clear any stale flags from expired deals

    // ✅ APPLY COMBO DISCOUNT
    if (combos.length) {
      const comboDocs = await comboModel
        .find({
          _id: { $in: combos },
        })
        .lean();

      const comboOps = comboDocs.map((c) => {
        const discountAmount =
          discountType === "percentage"
            ? (c.totalMrp * discountValue) / 100
            : discountValue;

        return {
          updateOne: {
            filter: { _id: c._id },
            update: {
              specialOffer: true,
              discount: discountValue,
              discountAmount,
              comboPrice: c.totalMrp - discountAmount,
            },
          },
        };
      });

      await comboModel.bulkWrite(comboOps);
    }

    if (products.length) {
      await ProductModel.updateMany(
        { _id: { $in: products } },
        { hotDeal: false, specialOffer: false, discount: null },
      );
    }
    if (variants.length) {
      await VariantModel.updateMany(
        { _id: { $in: variants } },
        {
          hotDeal: false,
          specialOffer: false,
          discount: null,
          discountAmount: 0,
        },
      );
    }

    // 2. If products are selected → fetch all their variants
    let allVariantIds = [...variants.map((id) => id.toString())];

    if (products.length) {
      // Mark specialOffer: true on all selected products
      await ProductModel.updateMany(
        { _id: { $in: products } },
        { specialOffer: true, discount: discountValue },
      );

      // Get all variant ids belonging to these products
      const productVariants = await VariantModel.find(
        { productId: { $in: products } },
        "_id",
      ).lean();

      const productVariantIds = productVariants.map((v) => v._id.toString());

      // Merge & deduplicate
      const merged = new Set([...allVariantIds, ...productVariantIds]);
      allVariantIds = [...merged];
    }

    // 3. Apply discount on all resolved variants
    if (allVariantIds.length) {
      const variantDocs = await VariantModel.find({
        _id: { $in: allVariantIds },
      }).lean();

      const bulkOps = variantDocs.map((v) => {
        const { discountAmount, finalPrice } = SpecialOfferService.calcDiscount(
          v.mrp,
          discountType,
          discountValue,
        );

        return {
          updateOne: {
            filter: { _id: v._id },
            update: {
              specialOffer: true,
              discount: discountType === "percentage" ? discountValue : null,
              discountAmount,
              finalPrice,
            },
          },
        };
      });

      await VariantModel.bulkWrite(bulkOps);
    }

    // 4. Save offer record (store all resolved variant ids)
    const offer = await SpecialOffer.create({
      title,
      products,
      variants: allVariantIds,
      combos,
      discountType,
      discountValue,
      startDate,
      endDate,
    });

    return offer;
  }

  // ─── Deactivate ───────────────────────────────────────────────────────────

  static async deactivate(offerId) {
    const offer = await SpecialOffer.findById(offerId);
    if (!offer) throw new Error("Special offer not found.");
    if (!offer.isActive) throw new Error("Special offer is already inactive.");

    // Revert product flags
    if (offer.products.length) {
      await ProductModel.updateMany(
        { _id: { $in: offer.products } },
        { specialOffer: false, discount: null },
      );
    }

    // Revert combo flags
    if (offer.combos.length) {
      const comboDocs = await comboModel
        .find({ _id: { $in: offer.combos } }, "_id totalMrp")
        .lean();

      const comboOps = comboDocs.map((c) => ({
        updateOne: {
          filter: { _id: c._id },
          update: {
            specialOffer: false,
            discount: null,
            discountAmount: 0,
            comboPrice: c.totalMrp ?? 0,
          },
        },
      }));

      await comboModel.bulkWrite(comboOps);
    }

    // Revert variant flags & prices
    if (offer.variants.length) {
      const variantDocs = await VariantModel.find(
        { _id: { $in: offer.variants } },
        "_id mrp",
      ).lean();

      const bulkOps = variantDocs.map((v) => ({
        updateOne: {
          filter: { _id: v._id },
          update: {
            specialOffer: false,
            discount: null,
            discountAmount: 0,
            finalPrice: v.mrp ?? 0,
          },
        },
      }));

      await VariantModel.bulkWrite(bulkOps);
    }

    offer.isActive = false;
    await offer.save();

    return offer;
  }

  // ─── Get active offers ────────────────────────────────────────────────────

  static async getActive() {
    const now = new Date();
    return SpecialOffer.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate("products", "name icon images specialOffer discount")
      .populate(
        "variants",
        "mrp finalPrice discountAmount discount specialOffer weight size productId",
      )
      .populate("combos");
  }

  // ─── Get all (admin) ──────────────────────────────────────────────────────

  static async getAll({ page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      SpecialOffer.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("products", "name icon")
        .populate("variants", "mrp finalPrice weight size")
        .populate("combos"),
      SpecialOffer.countDocuments(),
    ]);
    return { data, total, page, limit };
  }

  // ─── Get by ID ────────────────────────────────────────────────────────────

  static async getById(id) {
    const offer = await SpecialOffer.findById(id)
      .populate("products", "name icon images discount specialOffer")
      .populate(
        "variants",
        "mrp finalPrice discountAmount discount specialOffer weight size productId",
      )
      .populate("combos");

    if (!offer) throw new Error("Special offer not found.");
    return offer;
  }
}
