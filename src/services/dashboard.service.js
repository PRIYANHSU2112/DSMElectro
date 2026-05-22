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
export function getDateBoundaries(filter) {
  const now = new Date();

  // Today 00:00
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let currentStart, currentEnd, prevStart, prevEnd;

  currentEnd = now;

  switch (filter) {
    case 'today':
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(currentStart);
      break;
    case 'last_7_days':
      currentStart = new Date(now);
      currentStart.setDate(currentStart.getDate() - 7);
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = currentStart;
      break;
    case 'all_time':
      currentStart = new Date(0);
      prevStart = new Date(0);
      prevEnd = new Date(0);
      break;
    default:
      if (filter && /^\d{4}$/.test(filter)) {
        const year = parseInt(filter, 10);
        currentStart = new Date(year, 0, 1);
        currentEnd = new Date(year + 1, 0, 1);
        prevStart = new Date(year - 1, 0, 1);
        prevEnd = new Date(year, 0, 1);
      } else {
        // month / this_month / default
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEnd = currentStart;
      }
      break;
  }

  return {
    now,
    todayStart,
    currentStart,
    currentEnd,
    prevStart,
    prevEnd,
  };
}

// ── Isolated heavy-computation functions ─────────────────────────────────────

export default class DashboardService {
  // ──────────────────────────────────────────────────────────────────────────
  //  1. PRODUCT STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getProductStats(dates) {
    const LOW_STOCK_THRESHOLD = 10;

    const [totalProducts, lowStockVariants, currentProducts, prevProducts] =
      await Promise.all([
        // Total products added in selected period
        productModel.countDocuments({
          disable: { $ne: true },
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),

        // Low-stock variants (current inventory state — always real-time)
        variantModel.countDocuments({
          disable: { $ne: true },
          stock: { $lte: LOW_STOCK_THRESHOLD, $gt: 0 },
        }),

        // Products added this period
        productModel.countDocuments({ createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd } }),

        // Products added previous period
        productModel.countDocuments({
          createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
        }),
      ]);

    return {
      totalSKUs: totalProducts,       // products in selected period
      lowStock: lowStockVariants,     // always real-time (inventory state)
      change: pctChange(currentProducts, prevProducts),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  2. MARKETING STATS (Flash Sales + Combos)
  // ──────────────────────────────────────────────────────────────────────────
  static async getMarketingStats(dates) {
    const now = dates.now;

    const [activeFlashSales, activeCombos, prevFlash, currentFlash] =
      await Promise.all([
        // Active flash sales right now (real-time state)
        flashSaleModel.countDocuments({
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        }),

        // Combos created in selected period
        comboModel.countDocuments({
          disable: { $ne: true },
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),

        // Flash sales created in previous period
        flashSaleModel.countDocuments({
          createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
        }),

        // Flash sales created in current period
        flashSaleModel.countDocuments({
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),
      ]);

    return {
      activeFlashSales,             // always real-time
      activeCombos,                 // combos in selected period
      change: pctChange(currentFlash, prevFlash),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  3. ORDER STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getOrderStats(dates) {
    const [pendingOrders, todayOrders, currentOrders, prevOrders, totalOrders] =
      await Promise.all([
        orderModel.countDocuments({ status: "PENDING" }),
        orderModel.countDocuments({ createdAt: { $gte: dates.todayStart } }),
        orderModel.countDocuments({ createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd } }),
        orderModel.countDocuments({
          createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
        }),
        // totalOrders = filtered by selected period (not all-time)
        orderModel.countDocuments({ createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd } }),
      ]);

    return {
      pending: pendingOrders,
      today: todayOrders,
      totalOrders,        // now = orders in selected period
      thisWeek: currentOrders,
      change: pctChange(currentOrders, prevOrders),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  4. REVENUE STATS (aggregation pipeline)
  // ──────────────────────────────────────────────────────────────────────────
  static async getRevenueStats(dates) {
    const [currentRevResult, prevRevResult] = await Promise.all([
      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
            status: { $nin: ["CANCELLED", "RETURNED"] },
            paymentStatus: "PAID",
          },
        },
        { $group: { _id: null, total: { $sum: "$orderTotal" } } },
      ]),

      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
            status: { $nin: ["CANCELLED", "RETURNED"] },
            paymentStatus: "PAID",
          },
        },
        { $group: { _id: null, total: { $sum: "$orderTotal" } } },
      ]),
    ]);

    const currentRevenue = currentRevResult[0]?.total || 0;
    const prevRevenue = prevRevResult[0]?.total || 0;

    return {
      totalRevenue: currentRevenue,   // revenue in selected period (filter-aware)
      thisMonth: currentRevenue,
      lastMonth: prevRevenue,
      change: pctChange(currentRevenue, prevRevenue),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  5. USER STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getUserStats(dates) {
    const [totalUsers, newToday, currentUsers, prevUsers] =
      await Promise.all([
        // Users registered in selected period
        userModel.countDocuments({
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),
        // New users today (always real-time)
        userModel.countDocuments({ createdAt: { $gte: dates.todayStart } }),
        // Users in current period (for change %)
        userModel.countDocuments({ createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd } }),
        // Users in previous period
        userModel.countDocuments({
          createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
        }),
      ]);

    return {
      totalUsers,           // users registered in selected period
      newToday,             // always real-time
      change: pctChange(currentUsers, prevUsers),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  6. AFFILIATE STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getAffiliateStats(dates) {
    const [totalAffiliates, activeAffiliates, pendingKYC, payoutsResult, currentAff, prevAff] =
      await Promise.all([
        // Affiliates joined in selected period
        affiliateModel.countDocuments({
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),
        // Approved affiliates in selected period
        affiliateModel.countDocuments({
          status: "approved",
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),
        // Pending KYC in selected period
        affiliateModel.countDocuments({
          status: "pending",
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),

        // Total payouts in selected period (commissions paid)
        affiliateCommissionModel.aggregate([
          {
            $match: {
              status: "paid",
              createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),

        affiliateModel.countDocuments({ createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd } }),
        affiliateModel.countDocuments({
          createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
        }),
      ]);

    return {
      totalAffiliates,          // joined in selected period
      activeAffiliates,         // approved in selected period
      pendingKYC,               // pending in selected period
      totalPayouts: payoutsResult[0]?.total || 0,  // paid in selected period
      change: pctChange(currentAff, prevAff),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  7. B2B / BULK INQUIRY STATS
  // ──────────────────────────────────────────────────────────────────────────
  static async getB2BStats(dates) {
    const [totalInquiries, unreadInquiries, currentB2B, prevB2B] =
      await Promise.all([
        // Inquiries in selected period
        bulkInquiryModel.countDocuments({
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),
        // Pending/unread inquiries in selected period
        bulkInquiryModel.countDocuments({
          status: "pending",
          createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
        }),
        bulkInquiryModel.countDocuments({ createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd } }),
        bulkInquiryModel.countDocuments({
          createdAt: { $gte: dates.prevStart, $lt: dates.prevEnd },
        }),
      ]);

    return {
      totalInquiries,       // inquiries in selected period
      unread: unreadInquiries,  // pending in selected period
      change: pctChange(currentB2B, prevB2B),
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
  //  9. RECENT ORDERS (for table in dashboard)
  // ──────────────────────────────────────────────────────────────────────────
  static async getRecentOrders(dates, limitCount = 10) {
    return orderModel
      .find({
        createdAt: { $gte: dates.currentStart, $lt: dates.currentEnd },
      })
      .sort({ createdAt: -1 })
      .limit(limitCount)
      .populate("customerId", "firstName lastName email number")
      .select("orderTotal status paymentStatus paymentMethod createdAt")
      .lean();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  10. ANALYTICS CHART DATA (Revenue Trend, Status, Top Products, Payment Split)
  // ──────────────────────────────────────────────────────────────────────────
  static async getRevenueChart(dates) {
    const startDate = dates.currentStart;
    const endDate   = dates.currentEnd;

    const [revenueTrend, orderStatusDistribution, paymentMethodSplit, topSellingProducts] = await Promise.all([
      // 1. Revenue Trend — grouped by day within selected period
      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lt: endDate },
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
      ]),

      // 2. Order Status Distribution — within selected period
      orderModel.aggregate([
        {
          $match: { createdAt: { $gte: startDate, $lt: endDate } }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            status: "$_id",
            count: 1
          }
        }
      ]),

      // 3. Payment Method Split — within selected period
      orderModel.aggregate([
        {
          $match: { createdAt: { $gte: startDate, $lt: endDate } }
        },
        {
          $group: {
            _id: "$paymentMethod",
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            method: "$_id",
            count: 1
          }
        }
      ]),

      // 4. Top Selling Products — within selected period
      orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lt: endDate },
            status: { $nin: ["CANCELLED", "RETURNED"] }
          }
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product.productId",
            totalSold: { $sum: "$product.quantity" }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            name: { $ifNull: ["$productDetails.name", "Unknown Product"] },
            totalSold: 1
          }
        }
      ])
    ]);

    return {
      revenueTrend,
      orderStatusDistribution,
      paymentMethodSplit,
      topSellingProducts
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MAIN: Orchestrate all stats in parallel with Redis caching
  // ══════════════════════════════════════════════════════════════════════════
  static async getFullDashboard(filter, skipCache = false) {
    const CACHE_KEY = `dashboard:admin:full:${filter || 'month'}`;
    const CACHE_TTL = 120; // 2 minutes

    // DEBUG: log what filter + dates are being used
    const dates = getDateBoundaries(filter);
    console.log(`[DashboardService] filter="${filter}" skipCache=${skipCache}`);
    console.log(`[DashboardService] currentStart=${dates.currentStart.toISOString()} currentEnd=${dates.currentEnd.toISOString()}`);
    console.log(`[DashboardService] prevStart=${dates.prevStart.toISOString()} prevEnd=${dates.prevEnd.toISOString()}`);

    // Try cache first (skip if nocache=1 was passed)
    if (!skipCache) {
      try {
        const cached = await redisClient.get(CACHE_KEY);
        if (cached) {
          console.log(`[DashboardService] Returning CACHED response for key: ${CACHE_KEY}`);
          return JSON.parse(cached);
        }
      } catch (err) {
        // Redis down — continue without cache
      }
    }

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
    
    ] = await Promise.all([
      DashboardService.getProductStats(dates),
      DashboardService.getMarketingStats(dates),
      DashboardService.getOrderStats(dates),
      DashboardService.getRevenueStats(dates),
      DashboardService.getUserStats(dates),
      DashboardService.getAffiliateStats(dates),
      DashboardService.getB2BStats(dates),
      DashboardService.getWalletStats(),
    
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

      // ── Debug info (remove in production) ──
      _debug: {
        applied_filter: filter || 'month (default)',
        currentStart: dates.currentStart,
        currentEnd: dates.currentEnd,
        prevStart: dates.prevStart,
        prevEnd: dates.prevEnd,
      },
    };

    // Cache result
    if (!skipCache) {
      try {
        await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(dashboard));
      } catch (err) {
        // Redis down — skip caching
      }
    }

    return dashboard;
  }
}
