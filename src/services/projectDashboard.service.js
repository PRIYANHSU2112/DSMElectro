import projectModel from "../model/project.model.js";
import projectRatingModel from "../model/projectRating.model.js";
import redisClient from "../config/redis.js";
import { getDateBoundaries } from "./dashboard.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

async function cacheGet(key) {
  try { const r = await redisClient.get(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
async function cacheSet(key, data, ttl) {
  try { await redisClient.setEx(key, ttl, JSON.stringify(data)); } catch { /* skip */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export default class ProjectDashboardService {

  // ── 1. CATALOG CARDS ─────────────────────────────────────────────────────
  static async getCatalogCards(dates) {
    const [
      totalProjects,
      currentProjects,
      prevProjects,
      disabledProjects,
      beginnerCount,
      intermediateCount,
      advanceCount,
      inventoryAgg,        // total MRP value of all active projects
    ] = await Promise.all([
      projectModel.countDocuments({ disable: { $ne: true } }),

      projectModel.countDocuments({
        disable: { $ne: true },
        createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
      }),
      projectModel.countDocuments({
        disable: { $ne: true },
        createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
      }),

      projectModel.countDocuments({ disable: true }),

      projectModel.countDocuments({ disable: { $ne: true }, projectType: "beginner" }),
      projectModel.countDocuments({ disable: { $ne: true }, projectType: "intermediate" }),
      projectModel.countDocuments({ disable: { $ne: true }, projectType: "advance" }),

      projectModel.aggregate([
        { $match: { disable: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalMrp: { $sum: "$mrp" },
            totalRevenue: { $sum: "$finalPrice" },
          },
        },
      ]),
    ]);

    return {
      totalProjects: {
        count: totalProjects,
        change: pctChange(currentProjects, prevProjects),
      },
      byLevel: {
        beginner: beginnerCount,
        intermediate: intermediateCount,
        advance: advanceCount,
      },
      disabled: { count: disabledProjects },
      catalogValue: Math.round(inventoryAgg[0]?.totalMrp || 0),
      revenueValue: Math.round(inventoryAgg[0]?.totalRevenue || 0),
    };
  }

  // ── 2. ENGAGEMENT CARDS ───────────────────────────────────────────────────
  //  Views, downloads, ratings — current vs previous period
  static async getEngagementCards(dates) {
    const [currentAgg, prevAgg, totalAgg] = await Promise.all([
      projectModel.aggregate([
        { $match: { disable: { $ne: true }, updatedAt: { $gte: dates.currentStart, $lt: dates.currentEnd } } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: "$totalViews" },
            totalDownloads: { $sum: "$totalDownloads" },
          },
        },
      ]),
      projectModel.aggregate([
        { $match: { disable: { $ne: true }, updatedAt: { $gte: dates.prevStart, $lt: dates.prevEnd } } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: "$totalViews" },
            totalDownloads: { $sum: "$totalDownloads" },
          },
        },
      ]),
      // All-time totals
      projectModel.aggregate([
        { $match: { disable: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: "$totalViews" },
            totalDownloads: { $sum: "$totalDownloads" },
            avgRating: { $avg: "$rating" },
            totalRatings: { $sum: "$totalRatings" },
          },
        },
      ]),
    ]);

    const cur = currentAgg[0] || { totalViews: 0, totalDownloads: 0 };
    const prev = prevAgg[0] || { totalViews: 0, totalDownloads: 0 };
    const total = totalAgg[0] || { totalViews: 0, totalDownloads: 0, avgRating: 0, totalRatings: 0 };

    // Rating stats for current period
    const [currentRatings, prevRatings] = await Promise.all([
      projectRatingModel.countDocuments({
        createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
      }),
      projectRatingModel.countDocuments({
        createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
      }),
    ]);

    return {
      views: {
        current: cur.totalViews,
        previous: prev.totalViews,
        total: total.totalViews,
        change: pctChange(cur.totalViews, prev.totalViews),
      },
      downloads: {
        current: cur.totalDownloads,
        previous: prev.totalDownloads,
        total: total.totalDownloads,
        change: pctChange(cur.totalDownloads, prev.totalDownloads),
      },
      ratings: {
        current: currentRatings,
        previous: prevRatings,
        total: total.totalRatings,
        avgRating: parseFloat((total.avgRating || 0).toFixed(2)),
        change: pctChange(currentRatings, prevRatings),
      },
    };
  }

  // ── 3. TOP CATEGORIES ─────────────────────────────────────────────────────
  static async getTopCategories() {
    const total = await projectModel.countDocuments({ disable: { $ne: true } });

    return projectModel.aggregate([
      { $match: { disable: { $ne: true }, category: { $exists: true } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: "categories", localField: "_id", foreignField: "_id", as: "cat",
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
            $round: [{ $multiply: [{ $divide: ["$count", total || 1] }, 100] }, 1],
          },
        },
      },
    ]);
  }

  // ── 4. TOP PERFORMERS — by downloads or views, with period % change ────────
  static async getTopPerformers({ sortBy = "downloads", categoryId, limit = 10 } = {}, dates) {
    const sortField = sortBy === "views" ? "totalViews" : "totalDownloads";

    const filter = { disable: { $ne: true } };
    if (categoryId) filter.category = new (await import("mongoose")).default.Types.ObjectId(categoryId);

    const [currentTop, allProjects] = await Promise.all([
      projectModel
        .find(filter)
        .sort({ [sortField]: -1 })
        .limit(limit)
        .select("title icon category projectType mrp finalPrice discount totalViews totalDownloads rating totalRatings")
        .populate("category", "name")
        .populate("subCategory", "name")
        .lean(),

      // For prev-period context — fetch all project IDs to cross-reference
      projectModel.find(filter).select("_id totalViews totalDownloads").lean(),
    ]);

    // NOTE: views/downloads are cumulative fields on the model (no per-period tracking)
    // We compare against the global average as a proxy for relative performance
    const globalAvgViews = allProjects.reduce((s, p) => s + (p.totalViews || 0), 0) / (allProjects.length || 1);
    const globalAvgDownloads = allProjects.reduce((s, p) => s + (p.totalDownloads || 0), 0) / (allProjects.length || 1);

    return currentTop.map((p, idx) => ({
      rank: idx + 1,
      projectId: p._id,
      title: p.title,
      icon: p.icon,
      category: p.category?.name || null,
      projectType: p.projectType,
      mrp: p.mrp,
      finalPrice: p.finalPrice,
      discount: p.discount,
      totalViews: p.totalViews,
      totalDownloads: p.totalDownloads,
      avgRating: p.rating,
      totalRatings: p.totalRatings,
      // relative % vs global average
      viewsVsAvg: pctChange(p.totalViews, Math.round(globalAvgViews)),
      downloadsVsAvg: pctChange(p.totalDownloads, Math.round(globalAvgDownloads)),
    }));
  }

  // ── 5. RECENT PROJECTS ────────────────────────────────────────────────────
  static async getRecentProjects(limit = 5) {
    return projectModel
      .find({ disable: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("title icon projectType mrp finalPrice discount rating totalRatings totalViews totalDownloads createdAt")
      .populate("category", "name")
      .populate("subCategory", "name")
      .lean();
  }

  // ── 6. RECENT RATINGS ─────────────────────────────────────────────────────
  static async getRecentRatings(limit = 5) {
    return projectRatingModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("project", "title icon")
      .populate("user", "firstName lastName email")
      .select("rating review createdAt")
      .lean();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MAIN — Full project dashboard
  // ══════════════════════════════════════════════════════════════════════════
  static async getFullProjectDashboard({ filter, sortBy = "downloads", categoryId, limit = 10 } = {}) {
    const CACHE_KEY = `project:dashboard:full:${filter || "month"}:${sortBy}:${categoryId || "all"}:${limit}`;
    const CACHE_TTL = 120; // 2 minutes

    const cached = await cacheGet(CACHE_KEY);
    if (cached) return cached;

    const dates = getDateBoundaries(filter);

    const [catalogCards, engagementCards, topCategories, topPerformers, recentProjects, recentRatings] =
      await Promise.all([
        ProjectDashboardService.getCatalogCards(dates),
        ProjectDashboardService.getEngagementCards(dates),
        ProjectDashboardService.getTopCategories(),
        ProjectDashboardService.getTopPerformers({ sortBy, categoryId, limit }, dates),
        ProjectDashboardService.getRecentProjects(5),
        ProjectDashboardService.getRecentRatings(5),
      ]);

    const result = {
      // ── KPI Cards ──
      cards: {
        catalog: catalogCards,
        engagement: engagementCards,
      },

      // ── Summary row ──
      summary: {
        totalProjects: catalogCards.totalProjects.count,
        projectChange: catalogCards.totalProjects.change,
        catalogValue: catalogCards.catalogValue,
        disabled: catalogCards.disabled.count,
        byLevel: catalogCards.byLevel,
        totalViews: engagementCards.views.total,
        viewsChange: engagementCards.views.change,
        totalDownloads: engagementCards.downloads.total,
        downloadsChange: engagementCards.downloads.change,
        avgRating: engagementCards.ratings.avgRating,
        totalRatings: engagementCards.ratings.total,
        ratingsChange: engagementCards.ratings.change,
      },

      // ── Category breakdown ──
      topCategories,

      // ── Top performers (by downloads or views) ──
      topPerformers: {
        sortBy,
        performers: topPerformers,
        topProject: topPerformers[0] || null,   // hero card
      },

      // ── Recent activity ──
      recentProjects,
      recentRatings,
    };

    await cacheSet(CACHE_KEY, result, CACHE_TTL);
    return result;
  }

  // ── Individual widget methods ─────────────────────────────────────────────
  static async getCatalogStats(filter) {
    return ProjectDashboardService.getCatalogCards(getDateBoundaries(filter));
  }

  static async getEngagementStats(filter) {
    return ProjectDashboardService.getEngagementCards(getDateBoundaries(filter));
  }

  static async getTopPerformersOnly({ filter, sortBy, categoryId, limit }) {
    return ProjectDashboardService.getTopPerformers(
      { sortBy, categoryId, limit },
      getDateBoundaries(filter)
    );
  }
}
