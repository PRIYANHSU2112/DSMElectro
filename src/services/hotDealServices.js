import hotDealModel from "../model/hotDeal.model.js";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import redisClient from "../config/redis.js";
import { NotFoundError } from "../utils/apiResponse.js";

// ─── Redis Key Helpers ────────────────────────────────────────────────────────
const HD_ACTIVE_KEY  = "hot-deals:active";       // public user cache
const HD_ALL_PREFIX  = "hot-deals:admin:all:";    // admin list cache prefix
const HD_ID_PREFIX   = "hot-deals:admin:id:";     // single deal cache prefix
const PRODUCT_KEY    = "products:user:*";
const TTL_ACTIVE     = 60 * 5;   // 5 min
const TTL_ADMIN      = 60 * 2;   // 2 min

async function cacheGet(key) {
  try { const r = await redisClient.get(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
async function cacheSet(key, data, ttl) {
  try { await redisClient.setEx(key, ttl, JSON.stringify(data)); } catch { /* skip */ }
}

// ─────────────────────────────────────────
//  Helper: apply discount to variants
// ─────────────────────────────────────────
async function applyVariantDiscount(variantIds, productIds, discountType, discountValue) {
  const variants = await variantModel
    .find({
      $or: [
        { _id: { $in: variantIds } },
        { productId: { $in: productIds } },
      ],
    })
    .lean();

  const bulkOps = variants
    .map((v) => {
      if (!v.mrp || v.mrp <= 0) return null;

      let discountPercent = 0;
      let discountAmount = 0;

      if (discountType === "percentage") {
        discountPercent = discountValue;
        discountAmount = (v.mrp * discountPercent) / 100;
      } else {
        discountAmount = discountValue;
        discountPercent = (discountAmount / v.mrp) * 100;
      }

      const finalPrice = Math.max(0, v.mrp - discountAmount);

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

  if (bulkOps.length) await variantModel.bulkWrite(bulkOps);
}

// ─────────────────────────────────────────
//  Helper: apply discount to combos
// ─────────────────────────────────────────
async function applyComboDiscount(comboIds, discountType, discountValue) {
  const combos = await comboModel.find({ _id: { $in: comboIds } }).lean();

  const bulkOps = combos.map((c) => {
    const discountAmount =
      discountType === "percentage"
        ? (c.totalMrp * discountValue) / 100
        : discountValue;

    return {
      updateOne: {
        filter: { _id: c._id },
        update: {
          $set: {
            hotDeal: true,
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

// ─────────────────────────────────────────
//  Helper: clear all hot-deal + product cache
// ─────────────────────────────────────────
async function clearProductCache() {
  try {
    const [hdKeys, productKeys] = await Promise.all([
      redisClient.keys("hot-deals:*"),
      redisClient.keys(PRODUCT_KEY),
    ]);
    const all = [...hdKeys, ...productKeys];
    if (all.length) await redisClient.del(all);
  } catch { /* skip */ }
}

// ─────────────────────────────────────────
//  Main Service
// ─────────────────────────────────────────
export default class HotDealService {
  // ── CREATE ──────────────────────────────
  static async create(payload) {
    const deal = await hotDealModel.create(payload);

    const productIds = payload.products || [];
    const variantIds = payload.variants || [];
    const comboIds   = payload.combos   || [];

    await Promise.all([
      productIds.length &&
        productModel.updateMany(
          { _id: { $in: productIds } },
          { $set: { hotdeal: true } }
        ),
      productIds.length &&
        variantModel.updateMany(
          { productId: { $in: productIds } },
          { $set: { hotDeal: true } }
        ),
      variantIds.length &&
        variantModel.updateMany(
          { _id: { $in: variantIds } },
          { $set: { hotDeal: true } }
        ),
    ].filter(Boolean));

    if (variantIds.length || productIds.length)
      await applyVariantDiscount(variantIds, productIds, payload.discountType, payload.discountValue);

    if (comboIds.length)
      await applyComboDiscount(comboIds, payload.discountType, payload.discountValue);

    await clearProductCache();
    return deal;
  }

  // ── UPDATE (title, dates, discount, isActive) ──
  static async update(id, payload) {
    const deal = await hotDealModel.findById(id);
    if (!deal) throw new NotFoundError("Hot deal not found");

    const { products, variants, combos, ...safeFields } = payload; // prevent direct overwrite of items via update

    Object.assign(deal, safeFields);
    await deal.save();

    // If discount changed, re-apply to all existing items
    if (payload.discountType || payload.discountValue) {
      const discountType  = payload.discountType  || deal.discountType;
      const discountValue = payload.discountValue !== undefined ? payload.discountValue : deal.discountValue;

      await applyVariantDiscount(deal.variants, deal.products, discountType, discountValue);
      await applyComboDiscount(deal.combos, discountType, discountValue);
    }

    await clearProductCache();
    return deal;
  }

  // ── ADD ITEMS ───────────────────────────
  static async addItems(id, payload) {
    const deal = await hotDealModel.findById(id);
    if (!deal) throw new NotFoundError("Hot deal not found");

    const newProducts = payload.products || [];
    const newVariants = payload.variants || [];
    const newCombos   = payload.combos   || [];

    // Push unique IDs only
    deal.products = [...new Set([...deal.products.map(String), ...newProducts.map(String)])];
    deal.variants = [...new Set([...deal.variants.map(String), ...newVariants.map(String)])];
    deal.combos   = [...new Set([...deal.combos.map(String),   ...newCombos.map(String)])];

    await deal.save();

    // Mark new items and apply discounts
    await Promise.all([
      newProducts.length &&
        productModel.updateMany(
          { _id: { $in: newProducts } },
          { $set: { hotdeal: true } }
        ),
      newProducts.length &&
        variantModel.updateMany(
          { productId: { $in: newProducts } },
          { $set: { hotDeal: true } }
        ),
      newVariants.length &&
        variantModel.updateMany(
          { _id: { $in: newVariants } },
          { $set: { hotDeal: true } }
        ),
    ].filter(Boolean));

    if (newVariants.length || newProducts.length)
      await applyVariantDiscount(newVariants, newProducts, deal.discountType, deal.discountValue);

    if (newCombos.length)
      await applyComboDiscount(newCombos, deal.discountType, deal.discountValue);

    await clearProductCache();
    return deal;
  }

  // ── REMOVE ITEMS ────────────────────────
  static async removeItems(id, payload) {
    const deal = await hotDealModel.findById(id);
    if (!deal) throw new NotFoundError("Hot deal not found");

    const rmProducts = (payload.products || []).map(String);
    const rmVariants = (payload.variants || []).map(String);
    const rmCombos   = (payload.combos   || []).map(String);

    deal.products = deal.products.filter((p) => !rmProducts.includes(String(p)));
    deal.variants = deal.variants.filter((v) => !rmVariants.includes(String(v)));
    deal.combos   = deal.combos.filter((c)   => !rmCombos.includes(String(c)));

    await deal.save();

    // Reset hotDeal flag for removed items (only if not in another active deal)
    if (rmProducts.length) {
      await productModel.updateMany(
        { _id: { $in: rmProducts } },
        { $set: { hotdeal: false } }
      );
      await variantModel.updateMany(
        { productId: { $in: rmProducts } },
        { $set: { hotDeal: false } }
      );
    }
    if (rmVariants.length)
      await variantModel.updateMany(
        { _id: { $in: rmVariants } },
        { $set: { hotDeal: false } }
      );
    if (rmCombos.length)
      await comboModel.updateMany(
        { _id: { $in: rmCombos } },
        { $set: { hotDeal: false } }
      );

    await clearProductCache();
    return deal;
  }

  // ── GET ALL (Admin) with pagination + search + Redis ──
  static async getAll({ page = 1, limit = 10, search = "", status }) {
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const cacheKey = `${HD_ALL_PREFIX}${pageNum}:${limitNum}:${search}:${status || "all"}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const filter = {};
    if (search) filter.title = { $regex: search, $options: "i" };
    if (status === "active")   filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    const [deals, total] = await Promise.all([
      hotDealModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      hotDealModel.countDocuments(filter),
    ]);

    const result = {
      deals,
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

  // ── GET DEAL BY ID — fully populated + Redis ──
  static async getById(id) {
    const cacheKey = `${HD_ID_PREFIX}${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const deal = await hotDealModel
      .findById(id)
      .populate({ path: "products", select: "name images slug category brand hotdeal" })
      .populate({ path: "variants", select: "productId sku mrp finalPrice discount discountAmount hotDeal" })
      .populate({ path: "combos",   select: "name totalMrp comboPrice discount hotDeal" })
      .lean();

    if (!deal) throw new NotFoundError("Hot deal not found");
    await cacheSet(cacheKey, deal, TTL_ADMIN);
    return deal;
  }

  // ── GET ACTIVE DEALS (Public) — with Redis cache ──
  static async getActiveDeals({ page = 1, limit = 10, search = "" } = {}) {
    const now      = new Date();
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const cacheKey = `${HD_ACTIVE_KEY}:${pageNum}:${limitNum}:${search}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const filter = {
      isActive:  true,
      startDate: { $lte: now },
      endDate:   { $gte: now },
    };
    if (search) filter.title = { $regex: search, $options: "i" };

    const [deals, total] = await Promise.all([
      hotDealModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({ path: "products", select: "name images slug category brand hotdeal" })
        .populate({ path: "variants", select: "productId sku mrp finalPrice discount discountAmount hotDeal" })
        .populate({ path: "combos",   select: "name totalMrp comboPrice discount hotDeal" })
        .lean(),
      hotDealModel.countDocuments(filter),
    ]);

    const result = {
      deals,
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

  // ── TOGGLE STATUS (activate / deactivate) ───────────────────────────
  static async toggleStatus(id) {
    const deal = await hotDealModel.findById(id);
    if (!deal) throw new NotFoundError("Hot deal not found");

    deal.isActive = !deal.isActive;
    await deal.save();

    await clearProductCache();
    return deal;
  }
}
