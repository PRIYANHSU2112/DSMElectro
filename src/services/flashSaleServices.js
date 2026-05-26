import flashSaleModel from "../model/flashSale.model.js";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import redisClient from "../config/redis.js";
import { AppError, NotFoundError } from "../utils/apiResponse.js";

// ─── Redis Key Helpers ────────────────────────────────────────────────────────
const FLASH_ACTIVE_KEY  = "flash-sales:active";          // public user cache
const FLASH_ALL_PREFIX  = "flash-sales:admin:all:";      // admin list cache prefix
const FLASH_ID_PREFIX   = "flash-sales:admin:id:";       // single deal cache prefix
const PRODUCT_CACHE_KEY = "products:user:*";
const TTL_ACTIVE = 60 * 5;   // 5 min  — public active list
const TTL_ADMIN  = 60 * 2;   // 2 min  — admin lists

// ─── Redis Helpers ────────────────────────────────────────────────────────────
async function cacheGet(key) {
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function cacheSet(key, data, ttl) {
  try { await redisClient.setEx(key, ttl, JSON.stringify(data)); } catch { /* skip */ }
}

async function clearFlashCache() {
  try {
    const [adminKeys, productKeys] = await Promise.all([
      redisClient.keys("flash-sales:*"),
      redisClient.keys(PRODUCT_CACHE_KEY),
    ]);
    const all = [...adminKeys, ...productKeys];
    if (all.length) await redisClient.del(all);
  } catch { /* skip */ }
}

// ─── Discount helpers ─────────────────────────────────────────────────────────
async function applyVariantDiscount(variantIds, productIds, discountType, discountValue) {
  const variants = await variantModel
    .find({ $or: [{ _id: { $in: variantIds } }, { productId: { $in: productIds } }] })
    .lean();

  const bulkOps = variants
    .map((v) => {
      if (!v.mrp || v.mrp <= 0) return null;
      const discountAmount =
        discountType === "percentage" ? (v.mrp * discountValue) / 100 : discountValue;
      const discountPercent =
        discountType === "percentage" ? discountValue : (discountAmount / v.mrp) * 100;
      return {
        updateOne: {
          filter: { _id: v._id },
          update: {
            $set: {
              flashSale: true,
              discount: Math.round(discountPercent),
              discountAmount: Math.round(discountAmount),
              finalPrice: Math.round(Math.max(0, v.mrp - discountAmount)),
            },
          },
        },
      };
    })
    .filter(Boolean);

  if (bulkOps.length) await variantModel.bulkWrite(bulkOps);
}

async function applyComboDiscount(comboIds, discountType, discountValue) {
  const combos = await comboModel.find({ _id: { $in: comboIds } }).lean();
  const bulkOps = combos.map((c) => {
    const discountAmount =
      discountType === "percentage" ? (c.totalMrp * discountValue) / 100 : discountValue;
    return {
      updateOne: {
        filter: { _id: c._id },
        update: {
          $set: {
            flashSale: true,
            discount: discountValue,
            discountAmount: Math.round(discountAmount),
            comboPrice: Math.round(c.totalMrp - discountAmount),
          },
        },
      },
    };
  });
  if (bulkOps.length) await comboModel.bulkWrite(bulkOps);
}

async function resetVariantDiscount(variantIds, productIds) {
  const filter = {};
  if (variantIds.length && productIds.length) {
    filter.$or = [{ _id: { $in: variantIds } }, { productId: { $in: productIds } }];
  } else if (variantIds.length) {
    filter._id = { $in: variantIds };
  } else if (productIds.length) {
    filter.productId = { $in: productIds };
  } else {
    return;
  }

  const variants = await variantModel.find(filter).lean();
  const bulkOps = variants.map((v) => ({
    updateOne: {
      filter: { _id: v._id },
      update: {
        $set: {
          flashSale: false,
          discount: 0,
          discountAmount: 0,
          finalPrice: v.mrp ?? 0,
        },
      },
    },
  }));

  if (bulkOps.length) await variantModel.bulkWrite(bulkOps);
}

async function resetComboDiscount(comboIds) {
  const combos = await comboModel.find({ _id: { $in: comboIds } }, "_id totalMrp").lean();
  const bulkOps = combos.map((c) => ({
    updateOne: {
      filter: { _id: c._id },
      update: {
        $set: { flashSale: false, discount: null, discountAmount: 0, comboPrice: c.totalMrp ?? 0 },
      },
    },
  }));
  if (bulkOps.length) await comboModel.bulkWrite(bulkOps);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────────────────────────────────────
export default class FlashSaleService {

  static async deactivateSales(expiredSales) {
    if (!expiredSales || !expiredSales.length) return;

    const fsProductIds = new Set();
    const fsVariantIds = new Set();
    const fsComboIds = new Set();

    expiredSales.forEach((sale) => {
      sale.products?.forEach((id) => fsProductIds.add(id.toString()));
      sale.variants?.forEach((id) => fsVariantIds.add(id.toString()));
      sale.combos?.forEach((id) => fsComboIds.add(id.toString()));
    });

    const finalProductIds = [...fsProductIds];
    const finalVariantIds = [...fsVariantIds];
    const finalComboIds = [...fsComboIds];

    await Promise.all([
      finalProductIds.length && productModel.updateMany({ _id: { $in: finalProductIds } }, { $set: { flashSale: false } }),
      (finalVariantIds.length || finalProductIds.length) && resetVariantDiscount(finalVariantIds, finalProductIds),
      finalComboIds.length   && resetComboDiscount(finalComboIds),
      flashSaleModel.updateMany({ _id: { $in: expiredSales.map((s) => s._id) } }, { $set: { isActive: false } }),
    ].filter(Boolean));

    await clearFlashCache();
    console.log(`[LAZY CLEANUP] Deactivated ${expiredSales.length} expired flash sales.`);
  }

  // ── CREATE ──────────────────────────────────────────────────────────────────
  static async create(payload) {
    const productIds = payload.products || [];
    const variantIds = payload.variants || [];
    const comboIds   = payload.combos   || [];

    // Conflict checks
    if (productIds.length) {
      const clash = await productModel.findOne({ _id: { $in: productIds }, flashSale: true });
      if (clash) throw new AppError(`Product "${clash.name || clash._id}" is already in an active flash sale`, 400);
    }
    if (variantIds.length) {
      const clash = await variantModel.findOne({ _id: { $in: variantIds }, flashSale: true });
      if (clash) throw new AppError("One or more variants are already in an active flash sale", 400);
    }
    if (comboIds.length) {
      const clash = await comboModel.findOne({ _id: { $in: comboIds }, flashSale: true });
      if (clash) throw new AppError("One or more combos are already in an active flash sale", 400);
    }

    let parentProductIds = [];
    if (variantIds.length) {
      const parentVariants = await variantModel.find({ _id: { $in: variantIds } }).select("productId").lean();
      parentProductIds = parentVariants.map(v => v.productId).filter(Boolean);
    }
    const allProductIdsToUpdate = [...new Set([...productIds.map(String), ...parentProductIds.map(String)])];

    const sale = await flashSaleModel.create(payload);

    await Promise.all([
      allProductIdsToUpdate.length && productModel.updateMany({ _id: { $in: allProductIdsToUpdate } }, { $set: { flashSale: true } }),
      variantIds.length && variantModel.updateMany({ _id: { $in: variantIds } }, { $set: { flashSale: true } }),
    ].filter(Boolean));

    if (variantIds.length || productIds.length)
      await applyVariantDiscount(variantIds, productIds, payload.discountType, payload.discountValue);
    if (comboIds.length)
      await applyComboDiscount(comboIds, payload.discountType, payload.discountValue);

    await clearFlashCache();
    return sale;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────
  static async update(id, payload) {
    const sale = await flashSaleModel.findById(id);
    if (!sale) throw new NotFoundError("Flash sale not found");

    // Prevent accidental item array overwrite — use add/remove endpoints
    const { products, variants, combos, ...safeFields } = payload;
    Object.assign(sale, safeFields);
    await sale.save();

    // Re-apply discounts if discount fields changed
    if (payload.discountType !== undefined || payload.discountValue !== undefined) {
      const dType  = payload.discountType  ?? sale.discountType;
      const dValue = payload.discountValue ?? sale.discountValue;
      await applyVariantDiscount(sale.variants, sale.products, dType, dValue);
      await applyComboDiscount(sale.combos, dType, dValue);
    }

    await clearFlashCache();
    return sale;
  }

  // ── ADD ITEMS ────────────────────────────────────────────────────────────────
  static async addItems(saleId, payload) {
    const { products = [], variants = [], combos = [] } = payload;
    const sale = await flashSaleModel.findById(saleId);
    if (!sale) throw new NotFoundError("Flash sale not found");

    const existingProducts = sale.products.map(String);
    const existingVariants = sale.variants.map(String);
    const existingCombos   = sale.combos.map(String);

    const newProducts = products.filter((id) => !existingProducts.includes(id));
    const newVariants = variants.filter((id) => !existingVariants.includes(id));
    const newCombos   = combos.filter((id)   => !existingCombos.includes(id));

    if (newProducts.length) {
      const clash = await productModel.findOne({ _id: { $in: newProducts }, flashSale: true });
      if (clash) throw new AppError(`Product "${clash.name || clash._id}" is already in an active flash sale`, 400);
      sale.products.push(...newProducts);
      await productModel.updateMany({ _id: { $in: newProducts } }, { $set: { flashSale: true } });
    }
    if (newVariants.length) {
      const clash = await variantModel.findOne({ _id: { $in: newVariants }, flashSale: true });
      if (clash) throw new AppError("One or more variants are already in an active flash sale", 400);
      sale.variants.push(...newVariants);
      await variantModel.updateMany({ _id: { $in: newVariants } }, { $set: { flashSale: true } });

      const parentVariants = await variantModel.find({ _id: { $in: newVariants } }).select("productId").lean();
      const parentProductIds = parentVariants.map(v => v.productId).filter(Boolean);
      if (parentProductIds.length) {
        await productModel.updateMany({ _id: { $in: parentProductIds } }, { $set: { flashSale: true } });
      }
    }
    if (newCombos.length) {
      const clash = await comboModel.findOne({ _id: { $in: newCombos }, flashSale: true });
      if (clash) throw new AppError("One or more combos are already in an active flash sale", 400);
      sale.combos.push(...newCombos);
      await applyComboDiscount(newCombos, sale.discountType, sale.discountValue);
    }

    if (newVariants.length || newProducts.length)
      await applyVariantDiscount(newVariants, newProducts, sale.discountType, sale.discountValue);

    await sale.save();
    await clearFlashCache();
    return sale;
  }

  // ── REMOVE ITEMS ─────────────────────────────────────────────────────────────
  static async removeItems(saleId, payload) {
    const { products = [], variants = [], combos = [] } = payload;
    const sale = await flashSaleModel.findById(saleId);
    if (!sale) throw new NotFoundError("Flash sale not found");

    const rmProducts = products.map(String);
    const rmVariants = variants.map(String);
    const rmCombos   = combos.map(String);

    sale.products = sale.products.filter((p) => !rmProducts.includes(String(p)));
    sale.variants = sale.variants.filter((v) => !rmVariants.includes(String(v)));
    sale.combos   = sale.combos.filter((c)   => !rmCombos.includes(String(c)));
    await sale.save();

    await Promise.all([
      rmProducts.length && productModel.updateMany({ _id: { $in: rmProducts } }, { $set: { flashSale: false } }),
      (rmVariants.length || rmProducts.length) && resetVariantDiscount(rmVariants, rmProducts),
      rmCombos.length   && resetComboDiscount(rmCombos),
    ].filter(Boolean));

    await clearFlashCache();
    return sale;
  }

  // ── TOGGLE STATUS ────────────────────────────────────────────────────────────
  static async toggleStatus(id) {
    const sale = await flashSaleModel.findById(id);
    if (!sale) throw new NotFoundError("Flash sale not found");

    const becomingInactive = sale.isActive; // currently active → going false

    // If deactivating: reset all flags on items
    if (becomingInactive) {
      await Promise.all([
        sale.products.length && productModel.updateMany({ _id: { $in: sale.products } }, { $set: { flashSale: false } }),
        (sale.variants.length || sale.products.length) && resetVariantDiscount(sale.variants, sale.products),
        sale.combos.length   && resetComboDiscount(sale.combos),
      ].filter(Boolean));
    } else {
      // Re-activating: re-apply flags and discounts
      await Promise.all([
        sale.products.length && productModel.updateMany({ _id: { $in: sale.products } }, { $set: { flashSale: true } }),
        sale.variants.length && variantModel.updateMany({ _id: { $in: sale.variants } }, { $set: { flashSale: true } }),
      ].filter(Boolean));

      if (sale.variants.length || sale.products.length)
        await applyVariantDiscount(sale.variants, sale.products, sale.discountType, sale.discountValue);
      if (sale.combos.length)
        await applyComboDiscount(sale.combos, sale.discountType, sale.discountValue);
    }

    sale.isActive = !sale.isActive;
    await sale.save();
    await clearFlashCache();
    return sale;
  }

  // ── GET ALL — Admin (paginated + search, with Redis) ─────────────────────────
  static async getAll(query = {}) {
    const { page = 1, limit = 10, search = "", status } = query;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    // Cache key encodes all query params
    const cacheKey = `${FLASH_ALL_PREFIX}${pageNum}:${limitNum}:${search}:${status || "all"}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const filter = {};
    if (search) filter.title = { $regex: search, $options: "i" };
    if (status === "active")   filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    const [data, total] = await Promise.all([
      flashSaleModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      flashSaleModel.countDocuments(filter),
    ]);

    const result = {
      deals: data,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext:    pageNum < Math.ceil(total / limitNum),
        hasPrev:    pageNum > 1,
      },
    };

    await cacheSet(cacheKey, result, TTL_ADMIN);
    return result;
  }

  // ── GET BY ID — Admin (with Redis) ──────────────────────────────────────────
  static async getById(id) {
    const cacheKey = `${FLASH_ID_PREFIX}${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const sale = await flashSaleModel
      .findById(id)
      .populate({ path: "products", select: "name images slug category brand flashSale" })
      .populate({ path: "variants", select: "productId sku mrp finalPrice discount discountAmount flashSale" })
      .populate({ path: "combos",   select: "name totalMrp comboPrice discount flashSale" })
      .lean();

    if (!sale) throw new NotFoundError("Flash sale not found");

    await cacheSet(cacheKey, sale, TTL_ADMIN);
    return sale;
  }

  // ── GET ACTIVE — Public (heavy Redis cache) ──────────────────────────────────
  static async getActive({ page = 1, limit = 10, search = "" } = {}) {
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    // Cache key per page/search so pagination works correctly
    const cacheKey = `${FLASH_ACTIVE_KEY}:${pageNum}:${limitNum}:${search}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const now    = new Date();

    // Lazily clean up expired flash sales in the background/inline
    try {
      const expiredSales = await flashSaleModel
        .find({ endDate: { $lt: now }, isActive: true })
        .select("_id products variants combos")
        .lean();
      if (expiredSales.length) {
        await FlashSaleService.deactivateSales(expiredSales);
      }
    } catch (err) {
      console.error("[Lazy Cleanup] getActive failed:", err.message);
    }
    const filter = {
      isActive:  true,
      startDate: { $lte: now },
      endDate:   { $gte: now },
    };
    if (search) filter.title = { $regex: search, $options: "i" };

    const [data, total] = await Promise.all([
      flashSaleModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({ path: "products", select: "name images slug category brand flashSale" })
        .populate({ path: "variants", select: "productId sku mrp finalPrice discount discountAmount flashSale" })
        .populate({ path: "combos",   select: "name totalMrp comboPrice discount flashSale" })
        .lean(),
      flashSaleModel.countDocuments(filter),
    ]);

    const result = {
      deals: data,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext:    pageNum < Math.ceil(total / limitNum),
        hasPrev:    pageNum > 1,
      },
    };

    await cacheSet(cacheKey, result, TTL_ACTIVE);
    return result;
  }
}