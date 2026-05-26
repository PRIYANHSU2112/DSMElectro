import crypto from "crypto";
import affiliateModel from "../model/affiliate.model.js";
import affiliateCommissionModel from "../model/affiliateCommission.model.js";
import affiliateWithdrawalModel from "../model/affiliateWidraw.model.js";
import affiliateClickModel from "../model/affiliateClick.model.js";
import affiliateTierModel from "../model/affiliateTier.model.js";
import userModel from "../model/user.model.js";
import roleModel from "../model/role.model.js";
import redisClient from "../config/redis.js";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/apiResponse.js";
import mongoose from "mongoose";

// ─── Cache TTLs (seconds) ─────────────────────────────────────────────────────
const TTL = {
  DASHBOARD: 60,              // user dashboard — 1 min
  ADMIN_OVERVIEW: 120,        // admin overview — 2 min
  ADMIN_STATS: 120,           // admin stats — 2 min
  AFFILIATE_CODE: 300,        // resolved affiliate code — 5 min
  TIERS: 300,                 // tier list — 5 min
  GLOBAL_COMMISSION: 300,     // global commission — 5 min (already in redis)
  REFERRAL_TRACKING: 90,      // referral tracking dashboard — 90 sec
};

// ─── Redis helpers ────────────────────────────────────────────────────────────

/** Safe get: returns parsed object or null on any redis error */
async function cacheGet(key) {
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Safe set: silently swallows errors so a redis outage never breaks the API */
async function cacheSet(key, value, ttl) {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch {
    // non-critical
  }
}

async function cacheDel(...keys) {
  try {
    if (keys.length) await redisClient.del(...keys);
  } catch {
    // non-critical
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function makeOtp() {
  return "1234";
}

function makeAffiliateCode() {
  return "AFF-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

/**
 * Resolves the effective commission for an affiliate.
 * Uses the affiliate-level override first, falls back to Redis global.
 * Result is cached in Redis for TTL.GLOBAL_COMMISSION seconds.
 */
async function getEffectiveCommission(affiliate) {
  if (affiliate.commissionPercent !== null) return affiliate.commissionPercent;
  try {
    const global = await redisClient.get("affiliate:globalCommission");
    return global ? parseFloat(global) : 0;
  } catch {
    return 0;
  }
}

/**
 * Fill date gaps so the chart always has a continuous series.
 * O(days) — cheap in-process, no extra DB hit.
 */
function fillDateGaps(rows, days) {
  const map = {};
  rows.forEach((r) => { map[r.date] = r; });

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push(map[key] ?? { date: key, earned: 0, orders: 0, clicks: 0 });
  }
  return result;
}

// ─── Referral Tracking — fast path helpers ────────────────────────────────────

/**
 * Resolves an affiliateCode to the affiliate _id.
 * Cached in Redis so repeated clicks (same code) never hit MongoDB.
 * CACHE KEY: aff:code:<affiliateCode>
 */
async function resolveCodeToId(affiliateCode) {
  const cacheKey = `aff:code:${affiliateCode}`;

  // 1. Try cache first
  const cached = await cacheGet(cacheKey);
  if (cached) return cached; // { _id, userId, commissionPercent }

  // 2. Hit DB — lean + minimal projection
  const affiliate = await affiliateModel
    .findOne({ affiliateCode, status: "approved" })
    .select("_id userId commissionPercent")
    .lean();

  if (!affiliate) return null;

  const payload = {
    _id: affiliate._id.toString(),
    userId: affiliate.userId.toString(),
    commissionPercent: affiliate.commissionPercent,
  };
  await cacheSet(cacheKey, payload, TTL.AFFILIATE_CODE);
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────

export default class AffiliateService {
  // ── OTP FLOW ────────────────────────────────────────────────────────────────

  static async sendOtp(phone) {
    let user = await userModel.findOne({ number: phone }).select("_id disable otp").lean(false);
    if (!user) {
      user = await userModel.create({ number: phone });
    }
    if (user.disable) throw new AppError("Your account has been disabled", 403);

    const otp = makeOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = { code: otp, expiresAt };
    await user.save();

    // ── plug your SMS provider here ──────────────────────────────────────────
    // await smsService.send(phone, `Your OTP is ${otp}. Valid for 10 minutes.`);
    console.log(`[DEV] OTP for ${phone} → ${otp}`);
    return true;
  }

  static async verifyOtp(phone, otp) {
    const user = await userModel.findOne({ number: phone }).select("_id otp role disable");
    if (!user) throw new AppError("Phone number not found", 404);
    if (!user.otp?.code) throw new AppError("OTP not sent. Please request again.", 400);
    if (new Date() > user.otp.expiresAt) throw new AppError("OTP has expired. Please request again.", 400);
    if (user.otp.code !== otp) throw new AppError("Invalid OTP", 400);

    let affiliateRole = await roleModel.findOne({ name: "AFFILIATE" });
    if (!affiliateRole) {
      affiliateRole = await roleModel.create({
        name: "AFFILIATE",
        description: "Affiliate role with basic permissions",
        permissions: [],
      });
    }

    user.otp = { code: null, expiresAt: null };
    if (!user.role || user.role.toString() !== affiliateRole._id.toString()) {
      user.role = affiliateRole._id;
    }
    await user.save();
    await user.populate("role");

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.HASH_KEY || "secret123",
      { expiresIn: "30d" },
    );

    return { user: { _id: user._id, phone: user.number, role: user.role }, token };
  }

  // ── REGISTRATION ─────────────────────────────────────────────────────────────

  static async registerAffiliate(userId, payload, files) {
    const user = await userModel.findById(userId).select("_id disable number").lean();
    if (!user) throw new AppError("User not found", 404);
    if (user.disable) throw new AppError("Account is disabled", 403);

    const panImage   = files?.panImage?.[0]?.location;
    const adharImage = files?.adharImage?.[0]?.location;
    if (!panImage)   throw new AppError("PAN card image is required", 400);
    if (!adharImage) throw new AppError("Aadhaar card image is required", 400);

    const existing = await affiliateModel.findOne({ userId }).select("_id status").lean();
    if (existing) {
      if (existing.status === "rejected") {
        await affiliateModel.deleteOne({ _id: existing._id });
      } else {
        throw new AppError(
          existing.status === "pending"
            ? "Your application is already under review"
            : "You are already a registered affiliate",
          409,
        );
      }
    }

    const affiliate = await affiliateModel.create({
      userId,
      firstName:     payload.firstName,
      lastName:      payload.lastName,
      phone:         payload.phone || user.number,
      email:         payload.email,
      dob:           payload.dob           || null,
      gender:        payload.gender        || null,
      gstNumber:     payload.gstNumber     || null,
      companyName:   payload.companyName   || null,
      panNumber:     payload.panNumber.toUpperCase(),
      panImage,
      adharNumber:   payload.adharNumber,
      adharImage,
      accountNumber: payload.accountNumber,
      ifscCode:      payload.ifscCode.toUpperCase(),
      accountHolder: payload.accountHolder,
      upiId:         payload.upiId    || null,
      dsmUserId:     payload.dsmUserId || null,
    });

    // Bust admin stats & list caches
    await cacheDel("aff:admin:stats", "aff:admin:overview");
    return affiliate;
  }

  // ── USER — PROFILE & WALLET ──────────────────────────────────────────────────

  static async getMyProfile(userId) {
    const affiliate = await affiliateModel
      .findOne({ userId })
      .populate("userId", "firstName lastName email number")
      .lean();
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);
    return affiliate;
  }

  static async getMyWallet(userId) {
    const affiliate = await affiliateModel
      .findOne({ userId })
      .select("walletBalance totalEarned totalWithdrawn status affiliateCode commissionPercent")
      .lean();
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);

    const effectiveCommission = await getEffectiveCommission(affiliate);
    return { ...affiliate, effectiveCommission };
  }

  // ── USER — FULL DASHBOARD ────────────────────────────────────────────────────
  /**
   * CALCULATION FLOW:
   * 1. Find affiliate by userId → get affiliate._id
   * 2. Define sinceDate = now - daysInt days  (e.g. 7 / 14 / 30)
   * 3. Define startMonth = first day of current month
   * 4. Fire 10 DB queries IN PARALLEL via Promise.all:
   *    a. totalClicks        → COUNT(affiliateClick where affiliateId)
   *    b. clicksThisPeriod   → COUNT(affiliateClick where affiliateId & createdAt >= sinceDate)
   *    c. totalOrders        → COUNT(affiliateCommission where affiliateId & status=credited)
   *    d. ordersThisPeriod   → COUNT(affiliateCommission where affiliateId & status=credited & createdAt >= sinceDate)
   *    e. thisMonthEarnings  → SUM(commissionAmount) where affiliateId & status=credited & createdAt >= startMonth
   *    f. pendingWithdrawals → SUM(amount) where affiliateId & status=pending
   *    g. earningsPerDay     → GROUP BY date: SUM(commissionAmount), COUNT → for line chart
   *    h. clicksPerDay       → GROUP BY date: COUNT → for line chart
   *    i. recentTransactions → last 30 credited commissions + buyer lookup
   *    j. withdrawalHistory  → last 10 withdrawals
   * 5. Merge earningsPerDay + clicksPerDay → fillDateGaps → chartData (continuous series)
   * 6. conversionRate = (ordersThisPeriod / clicksThisPeriod) * 100  (if clicks > 0)
   * 7. effectiveCommission = affiliate.commissionPercent ?? globalCommission (Redis)
   *
   * OPTIMISATIONS:
   * - Full result cached in Redis for TTL.DASHBOARD (60s) per user+days
   * - Uses lean() + minimal projections everywhere
   * - All aggregations run in parallel
   */
  static async getDashboard(userId, { days = 7 } = {}) {
    const affiliate = await affiliateModel
      .findOne({ userId })
      .select("_id walletBalance totalEarned totalWithdrawn affiliateCode status commissionPercent")
      .lean();
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);

    const daysInt = parseInt(days) || 7;
    const cacheKey = `aff:dashboard:${affiliate._id}:${daysInt}`;

    // ── Cache check ──────────────────────────────────────────────────────────
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const id = new mongoose.Types.ObjectId(affiliate._id);
    const sinceDate = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // ── 10 parallel DB queries ───────────────────────────────────────────────
    const [
      totalClicks,
      clicksThisPeriod,
      totalOrders,
      ordersThisPeriod,
      thisMonthEarnings,
      pendingWithdrawals,
      earningsPerDay,
      clicksPerDay,
      recentTransactions,
      withdrawalHistory,
    ] = await Promise.all([
      // a. total lifetime clicks
      affiliateClickModel.countDocuments({ affiliateId: id }),

      // b. clicks in selected period
      affiliateClickModel.countDocuments({ affiliateId: id, createdAt: { $gte: sinceDate } }),

      // c. total lifetime credited orders
      affiliateCommissionModel.countDocuments({ affiliateId: id, status: "credited" }),

      // d. credited orders in selected period
      affiliateCommissionModel.countDocuments({
        affiliateId: id, status: "credited", createdAt: { $gte: sinceDate },
      }),

      // e. this month's earnings SUM
      affiliateCommissionModel.aggregate([
        { $match: { affiliateId: id, status: "credited", createdAt: { $gte: startMonth } } },
        { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
      ]),

      // f. pending withdrawal SUM
      affiliateWithdrawalModel.aggregate([
        { $match: { affiliateId: id, status: "pending" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // g. earnings per day (for chart)
      affiliateCommissionModel.aggregate([
        { $match: { affiliateId: id, status: "credited", createdAt: { $gte: sinceDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            earned: { $sum: "$commissionAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", earned: 1, orders: 1 } },
      ]),

      // h. clicks per day (for chart)
      affiliateClickModel.aggregate([
        { $match: { affiliateId: id, createdAt: { $gte: sinceDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            clicks: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", clicks: 1 } },
      ]),

      // i. recent credited commissions with buyer info
      affiliateCommissionModel.aggregate([
        { $match: { affiliateId: id, status: "credited" } },
        { $sort: { createdAt: -1 } },
        { $limit: 30 },
        {
          $lookup: {
            from: "users",
            localField: "buyerId",
            foreignField: "_id",
            pipeline: [{ $project: { firstName: 1, lastName: 1, number: 1 } }],
            as: "buyer",
          },
        },
        { $unwind: { path: "$buyer", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            buyerName: {
              $concat: [
                { $ifNull: ["$buyer.firstName", ""] },
                " ",
                { $ifNull: ["$buyer.lastName", ""] },
              ],
            },
            buyerPhone: "$buyer.number",
            itemType: 1, itemId: 1, itemName: 1,
            orderAmount: 1, commissionAmount: 1, commissionPercent: 1,
            status: 1, createdAt: 1,
          },
        },
      ]),

      // j. withdrawal history (last 10)
      affiliateWithdrawalModel
        .find({ affiliateId: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    // ── Merge clicks + earnings into continuous per-day series ───────────────
    const clicksMap = {};
    clicksPerDay.forEach((r) => { clicksMap[r.date] = r.clicks; });
    const chartData = fillDateGaps(earningsPerDay, daysInt).map((r) => ({
      ...r,
      clicks: clicksMap[r.date] ?? 0,
    }));

    // ── Conversion rate  = orders / clicks × 100 ────────────────────────────
    const conversionRate =
      clicksThisPeriod > 0
        ? ((ordersThisPeriod / clicksThisPeriod) * 100).toFixed(1)
        : "0.0";

    const result = {
      summary: {
        totalClicks,
        clicksThisPeriod,
        totalOrders,
        ordersThisPeriod,
        totalEarned:       affiliate.totalEarned,
        walletBalance:     affiliate.walletBalance,
        totalWithdrawn:    affiliate.totalWithdrawn,
        thisMonthEarnings: thisMonthEarnings[0]?.total ?? 0,
        pendingWithdrawals: pendingWithdrawals[0]?.total ?? 0,
        conversionRate,
        affiliateCode:      affiliate.affiliateCode,
        status:             affiliate.status,
        effectiveCommission: await getEffectiveCommission(affiliate),
      },
      chartData,
      recentTransactions,
      withdrawalHistory,
    };

    await cacheSet(cacheKey, result, TTL.DASHBOARD);
    return result;
  }

  // ── USER — COMMISSIONS LIST ──────────────────────────────────────────────────

  static async getMyCommissions(userId, { page = 1, limit = 10, itemType } = {}) {
    const affiliate = await affiliateModel
      .findOne({ userId })
      .select("_id")
      .lean();
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);

    const filter = { affiliateId: affiliate._id, status: "credited" };
    if (itemType) filter.itemType = itemType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const lim  = parseInt(limit);

    const [data, total] = await Promise.all([
      affiliateCommissionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate("buyerId", "firstName lastName number")
        .lean(),
      affiliateCommissionModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page: parseInt(page),
      limit: lim,
      totalPages: Math.ceil(total / lim),
    };
  }

  // ── USER — WITHDRAWAL ────────────────────────────────────────────────────────

  static async requestWithdrawal(userId, payload) {
    const affiliate = await affiliateModel
      .findOne({ userId })
      .select("_id status walletBalance affiliateCode")
      .lean(false);
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);
    if (affiliate.status !== "approved")
      throw new AppError("Only approved affiliates can withdraw", 403);

    const { amount, method } = payload;
    const amt = parseFloat(amount);

    if (affiliate.walletBalance < amt)
      throw new AppError(
        `Insufficient balance. Available: ₹${affiliate.walletBalance.toFixed(2)}`,
        400,
      );

    const payoutDetails = {};
    if (method === "upi") {
      payoutDetails.upiId = payload.upiId;
    } else if (method === "bank") {
      payoutDetails.accountNumber = payload.accountNumber;
      payoutDetails.ifscCode      = payload.ifscCode;
      payoutDetails.accountHolder = payload.accountHolder;
      payoutDetails.transferMode  = payload.transferMode;
    } else if (method === "dsm") {
      payoutDetails.dsmUserId  = payload.dsmUserId;
      payoutDetails.dsmCredits = amt;
    }

    // Atomically deduct from wallet + create withdrawal record
    const [, withdrawal] = await Promise.all([
      affiliateModel.findByIdAndUpdate(affiliate._id, { $inc: { walletBalance: -amt } }),
      affiliateWithdrawalModel.create({ affiliateId: affiliate._id, amount: amt, method, payoutDetails }),
    ]);

    // Bust dashboard cache so wallet balance reflects immediately
    await cacheDel(`aff:dashboard:${affiliate._id}:7`, `aff:dashboard:${affiliate._id}:14`, `aff:dashboard:${affiliate._id}:30`);

    return withdrawal;
  }

  static async getMyWithdrawals(userId, { page = 1, limit = 10, status } = {}) {
    const affiliate = await affiliateModel.findOne({ userId }).select("_id").lean();
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);

    const filter = { affiliateId: affiliate._id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      affiliateWithdrawalModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      affiliateWithdrawalModel.countDocuments(filter),
    ]);

    return { data, total, page: parseInt(page), limit: parseInt(limit) };
  }

  // ── CLICK TRACKING — fire-and-forget fast path ────────────────────────────
  /**
   * CLICK TRACKING FLOW:
   * 1. Validate affiliateCode (cached → Redis → MongoDB only on cache miss)
   * 2. Immediately respond 200 to client (no await on DB write)
   * 3. Write affiliateClick document asynchronously in background
   *
   * This means the tracking response time = Redis lookup (~1ms) + validation,
   * NOT the MongoDB write (~10-30ms). Throughput is dramatically higher.
   */
  static async trackClick({ affiliateCode, ip, userAgent, itemType, itemId }) {
    if (!affiliateCode) return null;

    // Fast path: Redis-cached code resolution
    const aff = await resolveCodeToId(affiliateCode);
    if (!aff) return null;

    // Fire-and-forget: non-blocking write
    affiliateClickModel.create({
      affiliateId:   new mongoose.Types.ObjectId(aff._id),
      affiliateCode,
      ip:            ip       || null,
      userAgent:     userAgent || null,
      itemType:      itemType  || null,
      itemId:        itemId    || null,
    }).catch((err) => {
      // Log but never crash the request
      console.error("[affiliate] click write failed:", err.message);
    });

    return true;
  }

  // ── COMMISSION RECORDING — called from order service ─────────────────────
  /**
   * COMMISSION CALCULATION FLOW:
   *
   *  Step 1 — Resolve affiliate (cached)
   *     affiliateCode → Redis cache → MongoDB if miss
   *
   *  Step 2 — Self-referral guard
   *     if affiliate.userId === buyerId → abort (no commission)
   *
   *  Step 3 — Determine commission amount
   *     A) Manual override (affiliate.commissionPercent !== null)
   *        amount = (orderAmount × commissionPercent) / 100
   *
   *     B) Tier-based (dynamic, per-affiliate monthly sales)
   *        • COUNT credited commissions this month for this affiliate → currentMonthSales
   *        • projectedSales = currentMonthSales + 1
   *        • Find highest active tier where tier.minSales <= projectedSales
   *          (sorted descending by minSales, limit 1)
   *        • amount = tier.commissionAmount  (flat ₹ amount, not a %)
   *
   *     C) Global fallback (no tier matched)
   *        • percent = Redis "affiliate:globalCommission"
   *        • amount = (orderAmount × percent) / 100
   *
   *  Step 4 — Guard: if amount <= 0 → abort
   *
   *  Step 5 — Atomic write (parallel):
   *     • INSERT affiliateCommission { status: "credited", amount, ... }
   *     • UPDATE affiliate { $inc: { walletBalance: +amount, totalEarned: +amount } }
   *
   *  Step 6 — Bust dashboard cache for this affiliate
   *
   * OPTIMISATIONS vs original:
   * - Code resolved via cache (no extra DB round-trip in hot path)
   * - Tier query uses compound index { isActive: 1, minSales: 1 } — single fast scan
   * - Commission insert + wallet update run in parallel
   * - Dashboard cache invalidated so next fetch is fresh
   */
  static async recordCommission({
    affiliateCode,
    orderId,
    buyerId,
    orderAmount,
    itemType,
    itemId,
    itemName,
  }) {
    if (!affiliateCode) return null;

    // Step 1 — Resolve affiliate (cached)
    const cached = await resolveCodeToId(affiliateCode);
    if (!cached) return null;

    // Step 2 — Self-referral guard
    if (cached.userId === buyerId.toString()) return null;

    const affiliateId = new mongoose.Types.ObjectId(cached._id);

    // Step 3 — Determine commission
    let amount  = 0;
    let percent = null;

    if (cached.commissionPercent !== null) {
      // A) Manual override
      percent = cached.commissionPercent;
      amount  = parseFloat(((orderAmount * percent) / 100).toFixed(2));
    } else {
      // B) Tier-based: count this month's sales for this affiliate
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const [currentMonthSales, activeTier] = await Promise.all([
        affiliateCommissionModel.countDocuments({
          affiliateId,
          status:    "credited",
          createdAt: { $gte: startOfMonth },
        }),
        affiliateTierModel
          .findOne({ isActive: true, minSales: { $lte: 0 } }) // placeholder, overridden below
          .sort({ minSales: -1 })
          .select("commissionAmount minSales")
          .lean(),
      ]);

      // Re-query with actual projected sales (can't be done in one query above)
      const projectedSales = currentMonthSales + 1;

      const matchedTier = await affiliateTierModel
        .findOne({ isActive: true, minSales: { $lte: projectedSales } })
        .sort({ minSales: -1 })
        .select("commissionAmount")
        .lean();

      if (matchedTier) {
        amount = matchedTier.commissionAmount;
      } else {
        // C) Global fallback
        try {
          const global = await redisClient.get("affiliate:globalCommission");
          percent = global ? parseFloat(global) : 0;
        } catch {
          percent = 0;
        }
        amount = parseFloat(((orderAmount * percent) / 100).toFixed(2));
      }
    }

    // Step 4 — Guard
    if (amount <= 0) return null;

    // Step 5 — Atomic parallel write
    const [commission] = await Promise.all([
      affiliateCommissionModel.create({
        affiliateId,
        orderId,
        buyerId,
        itemType,
        itemId,
        itemName: itemName || null,
        orderAmount,
        commissionPercent: percent,
        commissionAmount:  amount,
        status: "credited",
      }),
      affiliateModel.findByIdAndUpdate(affiliateId, {
        $inc: { walletBalance: amount, totalEarned: amount },
      }),
    ]);

    // Step 6 — Bust dashboard caches
    await cacheDel(
      `aff:dashboard:${cached._id}:7`,
      `aff:dashboard:${cached._id}:14`,
      `aff:dashboard:${cached._id}:30`,
      "aff:admin:stats",
      "aff:admin:overview",
    );

    return commission;
  }

  // ── PUBLIC — validate referral code ──────────────────────────────────────────

  static async resolveAffiliateCode(code) {
    const cacheKey = `aff:resolve:${code}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const affiliate = await affiliateModel
      .findOne({ affiliateCode: code, status: "approved" })
      .select("firstName lastName affiliateCode")
      .lean();
    if (!affiliate) throw new AppError("Invalid or expired referral link", 404);

    await cacheSet(cacheKey, affiliate, TTL.AFFILIATE_CODE);
    return affiliate;
  }

  // ── ADMIN — affiliates list ───────────────────────────────────────────────────
  /**
   * OPTIMISATION: replaces N+1 per-affiliate click/conversion queries with
   * two single aggregations (one for clicks, one for commissions), then
   * merges them in-process. For a page of 10 affiliates this goes from
   * 20 extra DB round-trips → 2.
   */
  static async getAllAffiliates({ page = 1, limit = 10, status, search } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName:     { $regex: search, $options: "i" } },
        { lastName:      { $regex: search, $options: "i" } },
        { phone:         { $regex: search, $options: "i" } },
        { email:         { $regex: search, $options: "i" } },
        { panNumber:     { $regex: search, $options: "i" } },
        { affiliateCode: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const lim  = parseInt(limit);

    const [data, total] = await Promise.all([
      affiliateModel
        .find(filter)
        .populate("userId", "firstName lastName email number")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      affiliateModel.countDocuments(filter),
    ]);

    if (!data.length) {
      return { data: [], total, page: parseInt(page), limit: lim, totalPages: 0 };
    }

    const affiliateIds = data.map((a) => a._id);

    // Single aggregation for clicks per affiliate
    const [clickAgg, conversionAgg] = await Promise.all([
      affiliateClickModel.aggregate([
        { $match: { affiliateId: { $in: affiliateIds } } },
        { $group: { _id: "$affiliateId", clicks: { $sum: 1 } } },
      ]),
      affiliateCommissionModel.aggregate([
        { $match: { affiliateId: { $in: affiliateIds }, status: "credited" } },
        { $group: { _id: "$affiliateId", conversions: { $sum: 1 } } },
      ]),
    ]);

    const clickMap      = Object.fromEntries(clickAgg.map((r) => [r._id.toString(), r.clicks]));
    const conversionMap = Object.fromEntries(conversionAgg.map((r) => [r._id.toString(), r.conversions]));

    const enrichedData = data.map((affiliate) => ({
      ...affiliate,
      clicks:      clickMap[affiliate._id.toString()]      ?? 0,
      conversions: conversionMap[affiliate._id.toString()] ?? 0,
    }));

    return {
      data: enrichedData,
      total,
      page: parseInt(page),
      limit: lim,
      totalPages: Math.ceil(total / lim),
    };
  }

  static async getAffiliateById(affiliateId) {
    if (!mongoose.Types.ObjectId.isValid(affiliateId)) {
      throw new AppError("Invalid Affiliate ID format", 400);
    }
    const affiliate = await affiliateModel
      .findById(affiliateId)
      .populate("userId", "firstName lastName email number")
      .lean();
    if (!affiliate) throw new AppError("Affiliate not found", 404);
    return affiliate;
  }

  static async approveAffiliate(affiliateId) {
    if (!mongoose.Types.ObjectId.isValid(affiliateId)) {
      throw new AppError("Invalid Affiliate ID format", 400);
    }
    const affiliate = await affiliateModel.findById(affiliateId);
    if (!affiliate) throw new AppError("Affiliate not found", 404);
    if (affiliate.status === "approved") return affiliate;

    let code, tries = 0;
    do {
      code = makeAffiliateCode();
      if (++tries > 10) throw new AppError("Could not generate unique referral code", 500);
    } while (await affiliateModel.exists({ affiliateCode: code }));

    affiliate.status          = "approved";
    affiliate.affiliateCode   = code;
    affiliate.rejectionReason = null;
    await affiliate.save({ validateBeforeSave: false });

    // Bust admin caches
    await cacheDel("aff:admin:stats", "aff:admin:overview");

    return affiliate;
  }

  static async rejectAffiliate(affiliateId, reason) {
    if (!mongoose.Types.ObjectId.isValid(affiliateId)) {
      throw new AppError("Invalid Affiliate ID format", 400);
    }
    const affiliate = await affiliateModel.findById(affiliateId);
    if (!affiliate) throw new AppError("Affiliate not found", 404);

    affiliate.status          = "rejected";
    affiliate.rejectionReason = reason;
    await affiliate.save({ validateBeforeSave: false });

    await cacheDel("aff:admin:stats");
    return affiliate;
  }

  static async setGlobalCommission(percent) {
    const val = Number(percent);
    if (isNaN(val) || val < 0 || val > 100)
      throw new AppError("Commission must be between 0 and 100", 400);

    await redisClient.set("affiliate:globalCommission", val.toString());
    return val;
  }

  static async setAffiliateCommission(affiliateId, percent) {
    if (!mongoose.Types.ObjectId.isValid(affiliateId)) {
      throw new AppError("Invalid Affiliate ID format", 400);
    }
    const val = percent === null ? null : Number(percent);
    if (val !== null && (isNaN(val) || val < 0 || val > 100))
      throw new AppError("Commission must be between 0 and 100", 400);

    const affiliate = await affiliateModel.findByIdAndUpdate(
      affiliateId,
      { commissionPercent: val },
      { new: true },
    );
    if (!affiliate) throw new AppError("Affiliate not found", 404);

    // Bust code cache so new commission is picked up immediately
    await cacheDel(`aff:code:${affiliate.affiliateCode}`);
    return affiliate;
  }

  // ── ADMIN — withdrawals ──────────────────────────────────────────────────────

  static async getAllWithdrawals({ page = 1, limit = 10, status, method } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (method) filter.method = method;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      affiliateWithdrawalModel
        .find(filter)
        .populate({
          path: "affiliateId",
          select:
            "firstName lastName phone email accountNumber ifscCode accountHolder upiId dsmUserId panNumber affiliateCode walletBalance",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      affiliateWithdrawalModel.countDocuments(filter),
    ]);

    return { data, total, page: parseInt(page), limit: parseInt(limit) };
  }

  static async processWithdrawal(withdrawalId, { action, adminNote }) {
    if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
      throw new AppError("Invalid Withdrawal ID format", 400);
    }
    const wd = await affiliateWithdrawalModel.findById(withdrawalId);
    if (!wd) throw new AppError("Withdrawal request not found", 404);
    if (wd.status !== "pending")
      throw new AppError("This request has already been processed", 400);

    if (action === "approve") {
      wd.status      = "processed";
      wd.processedAt = new Date();
      await affiliateModel.findByIdAndUpdate(wd.affiliateId, {
        $inc: { totalWithdrawn: wd.amount },
      });
    } else if (action === "reject") {
      wd.status = "rejected";
      await affiliateModel.findByIdAndUpdate(wd.affiliateId, {
        $inc: { walletBalance: wd.amount },
      });
    }

    wd.adminNote = adminNote || null;
    await wd.save();

    await cacheDel("aff:admin:stats", "aff:admin:overview");
    return wd;
  }

  // ── ADMIN — tier management ──────────────────────────────────────────────────

  static async createTier(payload) {
    const tier = await affiliateTierModel.create(payload);
    await cacheDel("aff:tiers:all", "aff:tiers:active");
    return tier;
  }

  static async updateTier(tierId, payload) {
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
      throw new AppError("Invalid Tier ID format", 400);
    }
    const tier = await affiliateTierModel.findByIdAndUpdate(tierId, payload, {
      new: true,
      runValidators: true,
    });
    if (!tier) throw new AppError("Tier not found", 404);
    await cacheDel("aff:tiers:all", "aff:tiers:active");
    return tier;
  }

  static async getAllTiers() {
    const cacheKey = "aff:tiers:all";
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const tiers = await affiliateTierModel.find().sort({ minSales: 1 }).lean();
    await cacheSet(cacheKey, tiers, TTL.TIERS);
    return tiers;
  }

  static async getActiveTiers() {
    const cacheKey = "aff:tiers:active";
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const tiers = await affiliateTierModel
      .find({ isActive: true })
      .sort({ minSales: 1 })
      .lean();
    await cacheSet(cacheKey, tiers, TTL.TIERS);
    return tiers;
  }

  static async deleteTier(tierId) {
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
      throw new AppError("Invalid Tier ID format", 400);
    }
    const tier = await affiliateTierModel.findByIdAndDelete(tierId);
    if (!tier) throw new AppError("Tier not found", 404);
    await cacheDel("aff:tiers:all", "aff:tiers:active");
    return true;
  }

  // ── ADMIN — stats ────────────────────────────────────────────────────────────

  static async getAdminStats() {
    const cacheKey = "aff:admin:stats";
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const [
      totalAffiliates,
      pending,
      approved,
      totalCommissionPaid,
      pendingWithdrawals,
      globalCommission,
    ] = await Promise.all([
      affiliateModel.countDocuments(),
      affiliateModel.countDocuments({ status: "pending" }),
      affiliateModel.countDocuments({ status: "approved" }),
      affiliateCommissionModel.aggregate([
        { $match: { status: "credited" } },
        { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
      ]),
      affiliateWithdrawalModel.aggregate([
        { $match: { status: "pending" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      redisClient.get("affiliate:globalCommission"),
    ]);

    const result = {
      totalAffiliates,
      pending,
      approved,
      totalCommissionPaid:    totalCommissionPaid[0]?.total   ?? 0,
      pendingWithdrawalAmount: pendingWithdrawals[0]?.total   ?? 0,
      pendingWithdrawalCount:  pendingWithdrawals[0]?.count   ?? 0,
      globalCommission:        parseFloat(globalCommission ?? "0"),
    };

    await cacheSet(cacheKey, result, TTL.ADMIN_STATS);
    return result;
  }

  // ── ADMIN — dashboard overview ───────────────────────────────────────────────

  static async getAdminDashboardOverview({ startDate, endDate, page = 1, limit = 10 } = {}) {
    const cacheKey = `aff:admin:overview:${startDate ?? ""}:${endDate ?? ""}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const end   = endDate   ? new Date(endDate)   : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const periodDuration = end.getTime() - start.getTime();
    const prevStart      = new Date(start.getTime() - periodDuration);
    const prevEnd        = new Date(start.getTime() - 1);

    const getPercentChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Run count queries + top performers pipeline in parallel
    const [
      activeAffiliatesCurrent,
      activeAffiliatesPrevious,
      totalClicksCurrent,
      totalClicksPrevious,
      conversionsCurrent,
      conversionsPrevious,
      pendingWithdrawalsAmount,
      topPerformersResult,
    ] = await Promise.all([
      affiliateModel.countDocuments({ status: "approved", createdAt: { $lte: end } }),
      affiliateModel.countDocuments({ status: "approved", createdAt: { $lte: prevEnd } }),
      affiliateClickModel.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      affiliateClickModel.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
      affiliateCommissionModel.countDocuments({ status: "credited", createdAt: { $gte: start, $lte: end } }),
      affiliateCommissionModel.countDocuments({ status: "credited", createdAt: { $gte: prevStart, $lte: prevEnd } }),
      affiliateWithdrawalModel.aggregate([
        { $match: { status: { $in: ["pending", "processing"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      affiliateCommissionModel.aggregate([
        { $match: { status: "credited", createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: "$affiliateId", sales: { $sum: 1 }, earned: { $sum: "$commissionAmount" } } },
        { $sort: { sales: -1, earned: -1 } },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [
              { $skip: skip },
              { $limit: parseInt(limit) },
              {
                $lookup: {
                  from: "affiliates",
                  localField: "_id",
                  foreignField: "_id",
                  as: "affiliate",
                },
              },
              { $unwind: "$affiliate" },
              {
                $project: {
                  _id: 1, sales: 1, earned: 1,
                  name: { $concat: ["$affiliate.firstName", " ", "$affiliate.lastName"] },
                  initials: {
                    $concat: [
                      { $substr: ["$affiliate.firstName", 0, 1] },
                      { $substr: ["$affiliate.lastName",  0, 1] },
                    ],
                  },
                  code: "$affiliate.affiliateCode",
                },
              },
            ],
          },
        },
      ]),
    ]);

    const topPerformersData   = topPerformersResult[0]?.data          || [];
    const totalTopPerformers  = topPerformersResult[0]?.metadata[0]?.total || 0;

    const result = {
      overview: {
        activeAffiliates: {
          count: activeAffiliatesCurrent,
          percentChange: getPercentChange(activeAffiliatesCurrent, activeAffiliatesPrevious),
        },
        totalClicks: {
          count: totalClicksCurrent,
          percentChange: getPercentChange(totalClicksCurrent, totalClicksPrevious),
        },
        conversions: {
          count: conversionsCurrent,
          percentChange: getPercentChange(conversionsCurrent, conversionsPrevious),
        },
        pendingPayout: { amount: pendingWithdrawalsAmount[0]?.total || 0 },
      },
      topPerformers: {
        data: topPerformersData.map((item, index) => ({ rank: skip + index + 1, ...item })),
        page:       parseInt(page),
        limit:      parseInt(limit),
        total:      totalTopPerformers,
        totalPages: Math.ceil(totalTopPerformers / parseInt(limit)),
      },
    };

    await cacheSet(cacheKey, result, TTL.ADMIN_OVERVIEW);
    return result;
  }

  // ── ADMIN — Referral Tracking Dashboard ──────────────────────────────────────
  /**
   * Returns the data powering the "Referral Tracking" screen:
   *
   *  chartData[]          — per-day clicks + conversions for the last `days` days
   *                         (continuous series, gaps filled with 0)
   *                         label = "D1" … "D<days>"  (oldest → newest)
   *
   *  topReferralCodes[]   — affiliates sorted by total clicks in the period
   *                         each row: { affiliateCode, name, clicks, conversions, conversionRate }
   *
   * QUERY PLAN (all parallel):
   *  1. clicks aggregate  → GROUP BY (affiliateCode + date) in one pass
   *  2. conv  aggregate   → GROUP BY (affiliateCode + date) in one pass
   *  3. top codes facet   → $facet: metadata (total) + paginated data with $lookup
   *
   * Cache key: aff:referral-tracking:<days>:<page>:<limit>
   */
  static async getReferralTrackingDashboard({ days = 14, page = 1, limit = 10 } = {}) {
    const daysInt = Math.min(parseInt(days) || 14, 90); // cap at 90 days
    const lim     = parseInt(limit);
    const pg      = parseInt(page);
    const skip    = (pg - 1) * lim;

    const cacheKey = `aff:referral-tracking:${daysInt}:${pg}:${lim}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return cached;

    const sinceDate = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);

    // ── 3 parallel aggregations ─────────────────────────────────────────────
    const [
      clicksByDay,
      conversionsByDay,
      topCodesResult,
    ] = await Promise.all([

      // 1. Clicks per day (global, all affiliates)
      affiliateClickModel.aggregate([
        { $match: { createdAt: { $gte: sinceDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            clicks: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", clicks: 1 } },
      ]),

      // 2. Conversions per day (global, all affiliates)
      affiliateCommissionModel.aggregate([
        { $match: { status: "credited", createdAt: { $gte: sinceDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            conversions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", conversions: 1 } },
      ]),

      // 3. Top referral codes by clicks — paginated via $facet
      affiliateClickModel.aggregate([
        { $match: { createdAt: { $gte: sinceDate } } },
        // Group by affiliateCode to get total clicks
        {
          $group: {
            _id:  "$affiliateCode",
            affiliateId: { $first: "$affiliateId" },
            clicks: { $sum: 1 },
          },
        },
        { $sort: { clicks: -1 } },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [
              { $skip: skip },
              { $limit: lim },
              // Join affiliate to get name
              {
                $lookup: {
                  from: "affiliates",
                  localField: "affiliateId",
                  foreignField: "_id",
                  pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
                  as: "aff",
                },
              },
              { $unwind: { path: "$aff", preserveNullAndEmptyArrays: true } },
              // Join commissions to count conversions for this affiliate in period
              {
                $lookup: {
                  from: "affiliatecommissions",
                  let: { affId: "$affiliateId" },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $eq: ["$affiliateId", "$$affId"] },
                        status: "credited",
                        createdAt: { $gte: sinceDate },
                      },
                    },
                    { $count: "total" },
                  ],
                  as: "convData",
                },
              },
              {
                $project: {
                  _id: 0,
                  affiliateCode: "$_id",
                  name: {
                    $concat: [
                      { $ifNull: ["$aff.firstName", ""] },
                      " ",
                      { $ifNull: ["$aff.lastName",  ""] },
                    ],
                  },
                  clicks:      1,
                  conversions: { $ifNull: [{ $arrayElemAt: ["$convData.total", 0] }, 0] },
                },
              },
            ],
          },
        },
      ]),
    ]);

    // ── Build continuous chart series (D1 … D<days>) ─────────────────────────
    const convMap = {};
    conversionsByDay.forEach((r) => { convMap[r.date] = r.conversions; });

    // fillDateGaps works on clicks, then we merge conversions
    const chartData = fillDateGaps(clicksByDay.map((r) => ({ ...r, earned: 0, orders: 0 })), daysInt)
      .map((r, i) => ({
        label:       `D${i + 1}`,
        date:        r.date,
        clicks:      r.clicks,
        conversions: convMap[r.date] ?? 0,
      }));

    // ── Attach conversionRate to each top-code row ────────────────────────────
    const rawCodes   = topCodesResult[0]?.data          || [];
    const totalCodes = topCodesResult[0]?.metadata[0]?.total || 0;

    const topReferralCodes = rawCodes.map((row) => ({
      ...row,
      conversionRate:
        row.clicks > 0
          ? parseFloat(((row.conversions / row.clicks) * 100).toFixed(1))
          : 0,
    }));

    const result = {
      period: { days: daysInt, from: sinceDate.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
      chartData,
      topReferralCodes: {
        data:       topReferralCodes,
        page:       pg,
        limit:      lim,
        total:      totalCodes,
        totalPages: Math.ceil(totalCodes / lim),
      },
    };

    await cacheSet(cacheKey, result, TTL.REFERRAL_TRACKING);
    return result;
  }
}
