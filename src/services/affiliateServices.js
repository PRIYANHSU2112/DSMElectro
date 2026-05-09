import crypto from "crypto";
import affiliateModel from "../model/affiliate.model.js";
import affiliateCommissionModel from "../model/affiliateCommission.model.js";
import affiliateWithdrawalModel from "../model/affiliateWidraw.model.js";
import affiliateClickModel from "../model/affiliateClick.model.js";
import userModel from "../model/user.model.js";
import redisClient from "../config/redis.js";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/apiResponse.js";
import productModel from "../model/product.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";

// ─── private helpers ──────────────────────────────────────────────────────────

function makeOtp() {
  return "1234";
}

function makeAffiliateCode() {
  return "AFF-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function getEffectiveCommission(affiliate) {
  if (affiliate.commissionPercent !== null) return affiliate.commissionPercent;
  const global = await redisClient.get("affiliate:globalCommission");
  return global ? parseFloat(global) : 0;
}

// ─── fill date gaps so the chart has a continuous series ─────────────────────
function fillDateGaps(rows, days) {
  const map = {};
  rows.forEach((r) => {
    map[r.date] = r;
  });

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push(map[key] ?? { date: key, earned: 0, orders: 0, clicks: 0 });
  }
  return result;
}

export default class AffiliateService {
  //  OTP FLOW  (reuses user.otp fields from your existing user model)

  static async sendOtp(phone) {
    // find or create a user record for this phone number
    let user = await userModel.findOne({ number: phone });
    if (!user) {
      user = await userModel.create({ number: phone });
    }
    if (user.disable) throw new AppError("Your account has been disabled", 403);

    const otp = makeOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    user.otp = { code: otp, expiresAt };
    await user.save();

    // ── plug your SMS provider here ──────────────────────────────────────────
    // await smsService.send(phone, `Your OTP is ${otp}. Valid for 10 minutes.`);
    console.log(`[DEV] OTP for ${phone} → ${otp}`);

    return true;
  }

  // ── verify OTP and return userId so frontend can proceed to register ───────
  static async verifyOtp(phone, otp) {
    const user = await userModel.findOne({ number: phone });

    if (!user) throw new AppError("Phone number not found", 404);
    if (!user.otp?.code)
      throw new AppError("OTP not sent. Please request again.", 400);
    if (new Date() > user.otp.expiresAt)
      throw new AppError("OTP has expired. Please request again.", 400);
    if (user.otp.code !== otp) throw new AppError("Invalid OTP", 400);

    // clear OTP
    user.otp = { code: null, expiresAt: null };

    // ✅ OPTIONAL: set role
    if (user.role !== "AFFILIATE") {
      user.role = "AFFILIATE";
    }

    await user.save();

    // ✅ GENERATE TOKEN
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.HASH_KEY || "secret123",
      { expiresIn: "30d" },
    );

    return {
      user: {
        _id: user._id,
        phone: user.number,
        role: user.role,
      },
      token,
    };
  }

  //  REGISTRATION

  static async registerAffiliate(userId, payload, files) {
    const user = await userModel.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    if (user.disable) throw new AppError("Account is disabled", 403);

    const panImage = files?.panImage?.[0]?.location;
    if (!panImage) throw new AppError("PAN card image is required", 400);

    const existing = await affiliateModel.findOne({ userId });
    if (existing) {
      if (existing.status === "rejected") {
        // allow re-application after rejection — delete old record
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
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone || user.number,
      email: payload.email,
      dob: payload.dob || null,
      gender: payload.gender || null,
      gstNumber: payload.gstNumber || null,
      companyName: payload.companyName || null,
      panNumber: payload.panNumber.toUpperCase(),
      panImage,
      accountNumber: payload.accountNumber,
      ifscCode: payload.ifscCode.toUpperCase(),
      accountHolder: payload.accountHolder,
      upiId: payload.upiId || null,
      dsmUserId: payload.dsmUserId || null,
    });

    return affiliate;
  }

  //  USER — PROFILE & WALLET

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
      .select(
        "walletBalance totalEarned totalWithdrawn status affiliateCode commissionPercent",
      )
      .lean();
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);

    // attach global commission for display
    const globalCommission = await redisClient.get(
      "affiliate:globalCommission",
    );
    return {
      ...affiliate,
      effectiveCommission:
        affiliate.commissionPercent ?? parseFloat(globalCommission ?? "0"),
    };
  }

  //  USER — FULL DASHBOARD

  static async getDashboard(userId, { days = 7 } = {}) {
    const affiliate = await affiliateModel.findOne({ userId });
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);

    const id = affiliate._id;
    const daysInt = parseInt(days) || 7;
    const sinceDate = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);
    const startMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

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
      // ── total lifetime clicks ──────────────────────────────────────────────
      affiliateClickModel.countDocuments({ affiliateId: id }),

      // ── clicks in selected period ──────────────────────────────────────────
      affiliateClickModel.countDocuments({
        affiliateId: id,
        createdAt: { $gte: sinceDate },
      }),

      // ── total lifetime orders ──────────────────────────────────────────────
      affiliateCommissionModel.countDocuments({
        affiliateId: id,
        status: "credited",
      }),

      // ── orders in selected period ──────────────────────────────────────────
      affiliateCommissionModel.countDocuments({
        affiliateId: id,
        status: "credited",
        createdAt: { $gte: sinceDate },
      }),

      // ── this month earnings ────────────────────────────────────────────────
      affiliateCommissionModel.aggregate([
        {
          $match: {
            affiliateId: id,
            status: "credited",
            createdAt: { $gte: startMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
      ]),

      // ── pending withdrawal total ───────────────────────────────────────────
      affiliateWithdrawalModel.aggregate([
        { $match: { affiliateId: id, status: "pending" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // ── earnings per day (for chart) ───────────────────────────────────────
      affiliateCommissionModel.aggregate([
        {
          $match: {
            affiliateId: id,
            status: "credited",
            createdAt: { $gte: sinceDate },
          },
        },
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

      // ── clicks per day (for chart) ─────────────────────────────────────────
      affiliateClickModel.aggregate([
        {
          $match: {
            affiliateId: id,
            createdAt: { $gte: sinceDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            clicks: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", clicks: 1 } },
      ]),

      // ── recent customer transactions ───────────────────────────────────────
      affiliateCommissionModel.aggregate([
        {
          $match: { affiliateId: id, status: "credited" },
        },
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
        {
          $unwind: { path: "$buyer", preserveNullAndEmptyArrays: true },
        },
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
            itemType: 1,
            itemId: 1,
            itemName: 1,
            orderAmount: 1,
            commissionAmount: 1,
            commissionPercent: 1,
            status: 1,
            createdAt: 1,
          },
        },
      ]),

      // ── withdrawal history (last 10) ───────────────────────────────────────
      affiliateWithdrawalModel
        .find({ affiliateId: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    // ── merge clicks + earnings into one per-day series ────────────────────
    const clicksMap = {};
    clicksPerDay.forEach((r) => {
      clicksMap[r.date] = r.clicks;
    });

    const mergedPerDay = fillDateGaps(earningsPerDay, daysInt).map((r) => ({
      ...r,
      clicks: clicksMap[r.date] ?? 0,
    }));

    const conversionRate =
      clicksThisPeriod > 0
        ? ((ordersThisPeriod / clicksThisPeriod) * 100).toFixed(1)
        : "0.0";

    return {
      summary: {
        totalClicks,
        clicksThisPeriod,
        totalOrders,
        ordersThisPeriod,
        totalEarned: affiliate.totalEarned,
        walletBalance: affiliate.walletBalance,
        totalWithdrawn: affiliate.totalWithdrawn,
        thisMonthEarnings: thisMonthEarnings[0]?.total ?? 0,
        pendingWithdrawals: pendingWithdrawals[0]?.total ?? 0,
        conversionRate,
        affiliateCode: affiliate.affiliateCode,
        status: affiliate.status,
        effectiveCommission: await getEffectiveCommission(affiliate),
      },
      chartData: mergedPerDay,
      recentTransactions,
      withdrawalHistory,
    };
  }

  //  USER — COMMISSIONS LIST

  static async getMyCommissions(
    userId,
    { page = 1, limit = 10, itemType } = {},
  ) {
    const affiliate = await affiliateModel.findOne({ userId });
    if (!affiliate) throw new AppError("Affiliate profile not found", 404);

    const filter = { affiliateId: affiliate._id, status: "credited" };
    if (itemType) filter.itemType = itemType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      affiliateCommissionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("buyerId", "firstName lastName number")
        .lean(),
      affiliateCommissionModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    };
  }

  //  USER — WITHDRAWAL

  static async requestWithdrawal(userId, payload) {
    const affiliate = await affiliateModel.findOne({ userId });
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

    // build payout snapshot
    const payoutDetails = {};

    if (method === "upi") {
      payoutDetails.upiId = payload.upiId;
    } else if (method === "bank") {
      payoutDetails.accountNumber = payload.accountNumber;
      payoutDetails.ifscCode = payload.ifscCode;
      payoutDetails.accountHolder = payload.accountHolder;
      payoutDetails.transferMode = payload.transferMode;
    } else if (method === "dsm") {
      payoutDetails.dsmUserId = payload.dsmUserId;
      payoutDetails.dsmCredits = amt; // 1 credit = ₹1
    }

    // atomically deduct from wallet
    await affiliateModel.findByIdAndUpdate(affiliate._id, {
      $inc: { walletBalance: -amt },
    });

    const withdrawal = await affiliateWithdrawalModel.create({
      affiliateId: affiliate._id,
      amount: amt,
      method,
      payoutDetails,
    });

    return withdrawal;
  }

  static async getMyWithdrawals(userId, { page = 1, limit = 10, status } = {}) {
    const affiliate = await affiliateModel.findOne({ userId });
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

  //  CLICK TRACKING

  static async trackClick({ affiliateCode, ip, userAgent, itemType, itemId }) {
    if (!affiliateCode) return null;

    const affiliate = await affiliateModel.findOne({
      affiliateCode,
      status: "approved",
    });
    if (!affiliate) return null;

    await affiliateClickModel.create({
      affiliateId: affiliate._id,
      affiliateCode,
      ip: ip || null,
      userAgent: userAgent || null,
      itemType: itemType || null,
      itemId: itemId || null,
    });

    return true;
  }

  //  COMMISSION RECORDING  — call from order service

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

    const affiliate = await affiliateModel.findOne({
      affiliateCode,
      status: "approved",
    });

    if (!affiliate) return null;

    // ❌ prevent self-referral
    if (affiliate.userId.toString() === buyerId.toString()) return null;

    // ✅ ONLY admin-controlled commission
    const percent = await getEffectiveCommission(affiliate);

    if (!percent || percent <= 0) return null;

    const amount = parseFloat(((orderAmount * percent) / 100).toFixed(2));

    if (amount <= 0) return null;

    const [commission] = await Promise.all([
      affiliateCommissionModel.create({
        affiliateId: affiliate._id,
        orderId,
        buyerId,
        itemType,
        itemId,
        itemName: itemName || null,
        orderAmount,
        commissionPercent: percent,
        commissionAmount: amount,
        status: "credited",
      }),

      affiliateModel.findByIdAndUpdate(affiliate._id, {
        $inc: {
          walletBalance: amount,
          totalEarned: amount,
        },
      }),
    ]);

    return commission;
  }

  //  PUBLIC — validate referral code

  static async resolveAffiliateCode(code) {
    const affiliate = await affiliateModel
      .findOne({ affiliateCode: code, status: "approved" })
      .select("firstName lastName affiliateCode")
      .lean();
    if (!affiliate) throw new AppError("Invalid or expired referral link", 404);
    return affiliate;
  }

  //  ADMIN

  static async getAllAffiliates({ page = 1, limit = 10, status, search } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { panNumber: { $regex: search, $options: "i" } },
        { affiliateCode: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      affiliateModel
        .find(filter)
        .populate("userId", "firstName lastName email number")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      affiliateModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    };
  }

  static async getAffiliateById(affiliateId) {
    const affiliate = await affiliateModel
      .findById(affiliateId)
      .populate("userId", "firstName lastName email number")
      .lean();
    if (!affiliate) throw new AppError("Affiliate not found", 404);
    return affiliate;
  }

  static async approveAffiliate(affiliateId) {
    const affiliate = await affiliateModel.findById(affiliateId);
    if (!affiliate) throw new AppError("Affiliate not found", 404);
    if (affiliate.status === "approved")
      throw new AppError("Already approved", 400);

    // generate collision-free referral code
    let code;
    let tries = 0;
    do {
      code = makeAffiliateCode();
      if (++tries > 10)
        throw new AppError("Could not generate unique referral code", 500);
    } while (await affiliateModel.exists({ affiliateCode: code }));

    affiliate.status = "approved";
    affiliate.affiliateCode = code;
    affiliate.rejectionReason = null;
    await affiliate.save();

    // TODO: send approval email / push notification
    return affiliate;
  }

  static async rejectAffiliate(affiliateId, reason) {
    const affiliate = await affiliateModel.findById(affiliateId);
    if (!affiliate) throw new AppError("Affiliate not found", 404);

    affiliate.status = "rejected";
    affiliate.rejectionReason = reason;
    await affiliate.save();

    // TODO: send rejection email / push notification
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
    const val = percent === null ? null : Number(percent);
    if (val !== null && (isNaN(val) || val < 0 || val > 100))
      throw new AppError("Commission must be between 0 and 100", 400);

    const affiliate = await affiliateModel.findByIdAndUpdate(
      affiliateId,
      { commissionPercent: val },
      { new: true },
    );
    if (!affiliate) throw new AppError("Affiliate not found", 404);
    return affiliate;
  }

  static async getAllWithdrawals({
    page = 1,
    limit = 10,
    status,
    method,
  } = {}) {
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
    const wd = await affiliateWithdrawalModel.findById(withdrawalId);
    if (!wd) throw new AppError("Withdrawal request not found", 404);
    if (wd.status !== "pending")
      throw new AppError("This request has already been processed", 400);

    if (action === "approve") {
      wd.status = "processed";
      wd.processedAt = new Date();
      await affiliateModel.findByIdAndUpdate(wd.affiliateId, {
        $inc: { totalWithdrawn: wd.amount },
      });
    } else if (action === "reject") {
      wd.status = "rejected";
      // refund reserved balance
      await affiliateModel.findByIdAndUpdate(wd.affiliateId, {
        $inc: { walletBalance: wd.amount },
      });
    }

    wd.adminNote = adminNote || null;
    await wd.save();

    return wd;
  }

  // ── admin dashboard stats ──────────────────────────────────────────────────
  static async getAdminStats() {
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
        {
          $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } },
        },
      ]),
      redisClient.get("affiliate:globalCommission"),
    ]);

    return {
      totalAffiliates,
      pending,
      approved,
      totalCommissionPaid: totalCommissionPaid[0]?.total ?? 0,
      pendingWithdrawalAmount: pendingWithdrawals[0]?.total ?? 0,
      pendingWithdrawalCount: pendingWithdrawals[0]?.count ?? 0,
      globalCommission: parseFloat(globalCommission ?? "0"),
    };
  }
}
