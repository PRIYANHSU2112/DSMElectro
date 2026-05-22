import mongoose from "mongoose";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import orderModel from "../model/order.model.js";
import redisClient from "../config/redis.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ((current - prev) / prev) * 100, rounded to 1dp */
function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

/** Returns { thisMonthStart, lastMonthStart, lastMonthEnd } */
function getMonthBounds() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - 7);
  return { now, thisMonthStart, lastMonthStart, lastMonthEnd, thisWeekStart };
}

async function cacheGet(key) {
  try { const r = await redisClient.get(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
async function cacheSet(key, data, ttl) {
  try { await redisClient.setEx(key, ttl, JSON.stringify(data)); } catch { /* skip */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export default class ProductDashboardService {

  // ── 1. OVERVIEW CARDS ─────────────────────────────────────────────────────
  //  Total products, trending count, low-stock count, inventory value
  static async getOverviewCards(dates) {
    const LOW_STOCK_THRESHOLD = 10;

    const [
      totalProducts,
      trendingProducts,
      currentPeriodProducts,
      prevPeriodProducts,
      lowStockVariants,
      outOfStockVariants,
      inventoryAgg,
    ] = await Promise.all([
      // Total products in selected period
      productModel.countDocuments({
        disable: { $ne: true },
        createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
      }),

      // Trending products in selected period
      productModel.countDocuments({
        disable: { $ne: true },
        trending: true,
        createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
      }),

      // Products added in current period
      productModel.countDocuments({
        disable: { $ne: true },
        createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
      }),

      // Products added in previous period
      productModel.countDocuments({
        disable: { $ne: true },
        createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
      }),

      // Low stock — always real-time inventory state
      variantModel.countDocuments({
        disable: { $ne: true },
        stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD },
      }),

      // Out of stock — always real-time
      variantModel.countDocuments({
        disable: { $ne: true },
        stock: { $lte: 0 },
      }),

      // Inventory value — always real-time
      variantModel.aggregate([
        { $match: { disable: { $ne: true }, stock: { $gt: 0 }, mrp: { $exists: true } } },
        { $group: { _id: null, totalValue: { $sum: { $multiply: ["$mrp", "$stock"] } } } },
      ]),
    ]);

    const trendingChange = pctChange(
      trendingProducts,
      Math.max(1, trendingProducts - 1)
    );

    return {
      totalProducts: {
        count: totalProducts,
        change: pctChange(currentPeriodProducts, prevPeriodProducts),
        label: "selected period",
      },
      trending: {
        count: trendingProducts,
        change: trendingChange,
      },
      lowStock: {
        count: lowStockVariants,
        label: "Needs reorder",
      },
      outOfStock: {
        count: outOfStockVariants,
      },
      inventoryValue: inventoryAgg[0]?.totalValue || 0,
    };
  }

  // ── 2. TOP CATEGORIES ─────────────────────────────────────────────────────
  //  Category breakdown by product count (%)
  static async getTopCategories() {
    const total = await productModel.countDocuments({ disable: { $ne: true } });

    const agg = await productModel.aggregate([
      { $match: { disable: { $ne: true }, categoryId: { $exists: true } } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          name: { $ifNull: ["$cat.name", "Uncategorised"] },
          count: 1,
          percentage: {
            $round: [
              { $multiply: [{ $divide: ["$count", total || 1] }, 100] },
              1,
            ],
          },
        },
      },
    ]);

    return agg;
  }

  // ── 3. OUT OF STOCK LIST ──────────────────────────────────────────────────
  static async getOutOfStockProducts(limit = 10) {
    return variantModel.aggregate([
      { $match: { disable: { $ne: true }, stock: { $lte: 0 } } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          variantId: "$_id",
          productId: "$product._id",
          productName: { $ifNull: ["$product.name", "Unknown"] },
          sku: "$product.sku",
          stock: 1,
          icon: "$product.icon",
        },
      },
    ]);
  }

  // ── 4. TOP PERFORMERS — ranked by units sold, with MoM % change ──────────
  //  Supports filters: sortBy (unitsSold|revenue), categoryId, limit
  static async getTopPerformers({ sortBy = "unitsSold", categoryId, limit = 10 } = {}, dates) {
    const baseMatch = {
      status: { $nin: ["CANCELLED", "RETURNED"] },
      "product.productId": { $exists: true },
    };

    // Current period vs previous period (from filter)
    const [currentAgg, prevAgg] = await Promise.all([
      orderModel.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product.productId",
            unitsSold: { $sum: "$product.quantity" },
            revenue: { $sum: { $multiply: ["$product.price", "$product.quantity"] } },
          },
        },
      ]),
      orderModel.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product.productId",
            unitsSold: { $sum: "$product.quantity" },
            revenue: { $sum: { $multiply: ["$product.price", "$product.quantity"] } },
          },
        },
      ]),
    ]);

    // Map prev month results for fast lookup
    const prevMap = new Map(prevAgg.map((p) => [String(p._id), p]));

    // Merge and calculate % change
    let merged = currentAgg.map((cur, idx) => {
      const prev = prevMap.get(String(cur._id));
      const prevUnits = prev?.unitsSold || 0;
      const prevRevenue = prev?.revenue || 0;
      return {
        productId: cur._id,
        unitsSold: cur.unitsSold,
        revenue: Math.round(cur.revenue),
        unitsChange: pctChange(cur.unitsSold, prevUnits),
        revenueChange: pctChange(Math.round(cur.revenue), Math.round(prevRevenue)),
      };
    });

    // Sort
    merged.sort((a, b) =>
      sortBy === "revenue" ? b.revenue - a.revenue : b.unitsSold - a.unitsSold
    );
    merged = merged.slice(0, limit);

    if (!merged.length) return [];

    // Fetch product details
    const productIds = merged.map((m) => m.productId);

    const productFilter = { _id: { $in: productIds } };
    if (categoryId) {
      productFilter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    const products = await productModel
      .find(productFilter)
      .select("name sku icon categoryId disable")
      .populate("categoryId", "name")
      .lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // Attach product info + stock
    const variantStocks = await variantModel.aggregate([
      { $match: { productId: { $in: productIds }, disable: { $ne: true } } },
      { $group: { _id: "$productId", totalStock: { $sum: "$stock" } } },
    ]);
    const stockMap = new Map(variantStocks.map((v) => [String(v._id), v.totalStock]));

    return merged
      .map((item, idx) => {
        const prod = productMap.get(String(item.productId));
        if (!prod) return null;            // filtered out (wrong category)
        const stock = stockMap.get(String(item.productId)) ?? 0;
        return {
          rank: idx + 1,
          productId: item.productId,
          name: prod.name,
          sku: prod.sku,
          icon: prod.icon,
          category: prod.categoryId?.name || null,
          unitsSold: item.unitsSold,
          revenue: item.revenue,
          unitsChange: item.unitsChange,    // +/- % vs last month
          revenueChange: item.revenueChange,
          totalStock: stock,
          stockStatus: stock <= 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "In Stock",
        };
      })
      .filter(Boolean);
  }

  // ── 5. TOP PERFORMER HERO (maximum selling product) ───────────────────────
  static async getTopPerformerHero(performers) {
    if (!performers?.length) return null;
    return performers[0]; // rank #1 is already computed
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MAIN ORCHESTRATOR — runs everything in parallel, caches result
  // ══════════════════════════════════════════════════════════════════════════
  static async getProductDashboard({ sortBy = "unitsSold", categoryId, limit = 10, dates } = {}) {
    const cacheKey = `product:dashboard:${sortBy}:${categoryId || "all"}:${limit}:${dates?.currentStart?.toISOString() || 'month'}`;
    const TTL = 120;

    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const [overview, topCategories, outOfStock, topPerformers] = await Promise.all([
      ProductDashboardService.getOverviewCards(dates),
      ProductDashboardService.getTopCategories(),
      ProductDashboardService.getOutOfStockProducts(10),
      ProductDashboardService.getTopPerformers({ sortBy, categoryId, limit }, dates),
    ]);

    const topPerformerHero = await ProductDashboardService.getTopPerformerHero(topPerformers);

    const result = {
      overview,
      topCategories,
      outOfStock,
      salesRanking: {
        sortBy,
        performers: topPerformers,
        topPerformer: topPerformerHero,
      },
    };

    await cacheSet(cacheKey, result, TTL);
    return result;
  }
}
