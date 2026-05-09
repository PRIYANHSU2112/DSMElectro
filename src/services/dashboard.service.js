import mongoose from "mongoose";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import orderModel from "../model/order.model.js";
import userModel from "../model/user.model.js";
import affiliateModel from "../model/affiliate.model.js";
import affiliateCommissionModel from "../model/affiliateCommission.model.js";
import bulkInquiryModel from "../model/bulkInquiry.model.js";
import flashSaleModel from "../model/flashSale.model.js";
import walletModel from "../model/wallet.model.js";
import redisClient from "../config/redis.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Calculate percentage change: ((current - previous) / previous) * 100 */
function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

/** Get start-of-day Date objects for "today" and "this month / last month" boundaries */
export function getDateBoundaries() {
  const now = new Date();

  // Today 00:00
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // This month 1st 00:00
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Last month boundaries
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart; // exclusive upper bound

  // This week (Monday start)
  const dayOfWeek = now.getDay();
  const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMon);

  // Last week
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = thisWeekStart;

  return {
    now,
    todayStart,
    thisMonthStart,
    lastMonthStart,
    lastMonthEnd,
    thisWeekStart,
    lastWeekStart,
    lastWeekEnd,
  };
}

// ── Isolated heavy-computation functions ─────────────────────────────────────

export default class DashboardService {
  // ──────────────────────────────────────────────────────────────────────────
  //  1. PRODUCT STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getProductStats(dates) {
    const LOW_STOCK_THRESHOLD = 10;

    const [totalProducts, lowStockVariants, thisMonthProducts, lastMonthProducts] =
      await Promise.all([
        // Total active SKUs (products)
        productModel.countDocuments({ disable: { $ne: true } }),

        // Low-stock variants
        variantModel.countDocuments({
          disable: { $ne: true },
          stock: { $lte: LOW_STOCK_THRESHOLD, $gt: 0 },
        }),

        // Products added this month
        productModel.countDocuments({ createdAt: { $gte: dates.thisMonthStart } }),

        // Products added last month
        productModel.countDocuments({
          createdAt: { $gte: dates.lastMonthStart, $lt: dates.lastMonthEnd },
        }),
      ]);

    return {
      totalSKUs: totalProducts,
      lowStock: lowStockVariants,
      change: pctChange(thisMonthProducts, lastMonthProducts),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  2. MARKETING STATS (Flash Sales + Combos)
  // ──────────────────────────────────────────────────────────────────────────
  static async getMarketingStats(dates) {
    const now = dates.now;

    const [activeFlashSales, activeCombos, lastMonthFlash, thisMonthFlash] =
      await Promise.all([
        flashSaleModel.countDocuments({
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        }),

        comboModel.countDocuments({ disable: { $ne: true } }),

        flashSaleModel.countDocuments({
          createdAt: { $gte: dates.lastMonthStart, $lt: dates.lastMonthEnd },
        }),

        flashSaleModel.countDocuments({
          createdAt: { $gte: dates.thisMonthStart },
        }),
      ]);

    return {
      activeFlashSales,
      activeCombos,
      change: pctChange(thisMonthFlash, lastMonthFlash),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  3. ORDER STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getOrderStats(dates) {
    const [pendingOrders, todayOrders, thisWeekOrders, lastWeekOrders, totalOrders] =
      await Promise.all([
        orderModel.countDocuments({ status: "PENDING" }),
        orderModel.countDocuments({ createdAt: { $gte: dates.todayStart } }),
        orderModel.countDocuments({ createdAt: { $gte: dates.thisWeekStart } }),
        orderModel.countDocuments({
          createdAt: { $gte: dates.lastWeekStart, $lt: dates.lastWeekEnd },
        }),
        orderModel.countDocuments({}),
      ]);

    return {
      pending: pendingOrders,
      today: todayOrders,
      totalOrders,
      thisWeek: thisWeekOrders,
      change: pctChange(thisWeekOrders, lastWeekOrders),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  4. REVENUE STATS (aggregation pipeline)
  // ──────────────────────────────────────────────────────────────────────────
  static async getRevenueStats(dates) {
    const [thisMonthRevResult, lastMonthRevResult] = await Promise.all([
      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: dates.thisMonthStart },
            status: { $nin: ["CANCELLED", "RETURNED"] },
            paymentStatus: "PAID",
          },
        },
        { $group: { _id: null, total: { $sum: "$orderTotal" } } },
      ]),

      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: dates.lastMonthStart, $lt: dates.lastMonthEnd },
            status: { $nin: ["CANCELLED", "RETURNED"] },
            paymentStatus: "PAID",
          },
        },
        { $group: { _id: null, total: { $sum: "$orderTotal" } } },
      ]),
    ]);

    const thisMonthRevenue = thisMonthRevResult[0]?.total || 0;
    const lastMonthRevenue = lastMonthRevResult[0]?.total || 0;

    // Total all-time revenue
    const [allTimeResult] = await orderModel.aggregate([
      {
        $match: {
          status: { $nin: ["CANCELLED", "RETURNED"] },
          paymentStatus: "PAID",
        },
      },
      { $group: { _id: null, total: { $sum: "$orderTotal" } } },
    ]);

    return {
      totalRevenue: allTimeResult?.total || 0,
      thisMonth: thisMonthRevenue,
      lastMonth: lastMonthRevenue,
      change: pctChange(thisMonthRevenue, lastMonthRevenue),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  5. USER STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getUserStats(dates) {
    const [totalUsers, activeUsers, newToday, thisMonthUsers, lastMonthUsers] =
      await Promise.all([
        userModel.countDocuments({}),
        userModel.countDocuments({ disable: { $ne: true } }),
        userModel.countDocuments({ createdAt: { $gte: dates.todayStart } }),
        userModel.countDocuments({ createdAt: { $gte: dates.thisMonthStart } }),
        userModel.countDocuments({
          createdAt: { $gte: dates.lastMonthStart, $lt: dates.lastMonthEnd },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      newToday,
      change: pctChange(thisMonthUsers, lastMonthUsers),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  6. AFFILIATE STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getAffiliateStats(dates) {
    const [totalAffiliates, activeAffiliates, pendingKYC, payoutsResult, thisMonth, lastMonth] =
      await Promise.all([
        affiliateModel.countDocuments({}),
        affiliateModel.countDocuments({ status: "approved" }),
        affiliateModel.countDocuments({ status: "pending" }),

        // Total payouts (totalWithdrawn sum)
        affiliateModel.aggregate([
          { $group: { _id: null, total: { $sum: "$totalWithdrawn" } } },
        ]),

        affiliateModel.countDocuments({ createdAt: { $gte: dates.thisMonthStart } }),
        affiliateModel.countDocuments({
          createdAt: { $gte: dates.lastMonthStart, $lt: dates.lastMonthEnd },
        }),
      ]);

    return {
      totalAffiliates,
      activeAffiliates,
      pendingKYC,
      totalPayouts: payoutsResult[0]?.total || 0,
      change: pctChange(thisMonth, lastMonth),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  7. B2B / BULK INQUIRY STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getB2BStats(dates) {
    const [totalInquiries, unreadInquiries, thisMonth, lastMonth] =
      await Promise.all([
        bulkInquiryModel.countDocuments({}),
        bulkInquiryModel.countDocuments({ status: "pending" }),
        bulkInquiryModel.countDocuments({ createdAt: { $gte: dates.thisMonthStart } }),
        bulkInquiryModel.countDocuments({
          createdAt: { $gte: dates.lastMonthStart, $lt: dates.lastMonthEnd },
        }),
      ]);

    return {
      totalInquiries,
      unread: unreadInquiries,
      change: pctChange(thisMonth, lastMonth),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  8. WALLET BALANCE STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getWalletStats() {
    const [balanceResult] = await walletModel.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: "$balance" },
          totalCoins: { $sum: "$coins" },
          totalReferral: { $sum: "$referralBalance" },
        },
      },
    ]);

    return {
      totalBalance: balanceResult?.totalBalance || 0,
      totalCoins: balanceResult?.totalCoins || 0,
      totalReferral: balanceResult?.totalReferral || 0,
      combinedBalance:
        (balanceResult?.totalBalance || 0) +
        (balanceResult?.totalReferral || 0),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  9. RECENT ORDERS (for chart / table in dashboard)
  // ──────────────────────────────────────────────────────────────────────────
  static async getRecentOrders(limitCount = 10) {
    return orderModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(limitCount)
      .populate("customerId", "firstName lastName email number")
      .select("orderTotal status paymentStatus paymentMethod createdAt")
      .lean();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  10. REVENUE CHART DATA (last 7 or 30 days)
  // ──────────────────────────────────────────────────────────────────────────
  static async getRevenueChart(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const result = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $nin: ["CANCELLED", "RETURNED"] },
          paymentStatus: "PAID",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$orderTotal" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: 1,
          orders: 1,
        },
      },
    ]);

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MAIN: Orchestrate all stats in parallel with Redis caching
  // ══════════════════════════════════════════════════════════════════════════
  static async getFullDashboard() {
    const CACHE_KEY = "dashboard:admin:full";
    const CACHE_TTL = 120; // 2 minutes

    // Try cache first
    try {
      const cached = await redisClient.get(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      // Redis down — continue without cache
    }

    const dates = getDateBoundaries();

    // Run ALL heavy computations in parallel
    const [
      products,
      marketing,
      orders,
      revenue,
      users,
      affiliates,
      b2b,
      wallet,
      // recentOrders,
      // revenueChart,
    ] = await Promise.all([
      DashboardService.getProductStats(dates),
      DashboardService.getMarketingStats(dates),
      DashboardService.getOrderStats(dates),
      DashboardService.getRevenueStats(dates),
      DashboardService.getUserStats(dates),
      DashboardService.getAffiliateStats(dates),
      DashboardService.getB2BStats(dates),
      DashboardService.getWalletStats(),
      // DashboardService.getRecentOrders(10),
      // DashboardService.getRevenueChart(7),
    ]);

    const dashboard = {
      // ── Top row cards ──
      cards: {
        products,
        marketing,
        orders: {
          pending: orders.pending,
          today: orders.today,
          change: orders.change,
        },
        affiliates,
        b2b,
        users,
      },

      // ── Summary row ──
      summary: {
        totalRevenue: revenue.totalRevenue,
        revenueChange: revenue.change,
        totalOrders: orders.totalOrders,
        ordersThisWeek: orders.thisWeek,
        totalUsers: users.totalUsers,
        userGrowth: users.change,
        totalAffiliates: affiliates.totalAffiliates,
        activeAffiliates: affiliates.activeAffiliates,
        pendingKYC: affiliates.pendingKYC,
        walletBalance: wallet.combinedBalance,
        lowStock: products.lowStock,
        pendingOrders: orders.pending,
      },

      // ── Chart data ──
      // revenueChart,
      // recentOrders,
    };

    // Cache result
    try {
      await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(dashboard));
    } catch (err) {
      // Redis down — skip caching
    }

    return dashboard;
  }
}
