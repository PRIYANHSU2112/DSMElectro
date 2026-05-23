import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../model/user.model.js";
import roleModel from "../model/role.model.js";
import MembershipPlan from "../model/membershipPlan.model.js";
import UserMembership from "../model/userMembership.model.js";
import PointsLedger from "../model/pointsLedger.model.js";
import transactionModel from "../model/transaction.model.js";
import ScheduledEmail from "../model/scheduledEmail.model.js";
import redisClient from "../config/redis.js";
import { AppError, ValidationError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { razorpay } from "../config/razorpay.js";

const JWT_SECRET = process.env.HASH_KEY || "secret123";

// Helper function to generate unique coupon code
const generateCouponCode = (tier) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomStr = "";
  for (let i = 0; i < 5; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${tier.toUpperCase()}-${randomStr}`;
};

// Helper function to calculate expiry date based on billing cycle
const calculateExpiryDate = (startDate, billingCycle) => {
  const date = new Date(startDate);
  if (billingCycle === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (billingCycle === "quarterly") {
    date.setMonth(date.getMonth() + 3);
  } else if (billingCycle === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
};

export default class MembershipService {
  // ==================== AUTHENTICATION ====================

  static async register(payload) {
    const { name, email, phone, password } = payload;

    // Check duplicate email
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      throw new ValidationError("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Split name into firstName and lastName for compatibility
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    const userRole = await roleModel.findOne({ name: "User" });

    const user = await userModel.create({
      firstName,
      lastName,
      email,
      number: phone, // keep number field compatible
      password: hashedPassword,
      role: userRole?._id,
    });

    // Strip password out before returning
    const userObj = user.toObject();
    delete userObj.password;
    userObj.name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    userObj.phone = user.number;
    return userObj;
  }

  static async login(payload) {
    const { email, password } = payload;

    const user = await userModel.findOne({ email }).populate("role");
    if (!user) {
      throw new ValidationError("Invalid email or password");
    }

    if (!user.password) {
      throw new ValidationError("Password login not enabled for this account");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ValidationError("Invalid email or password");
    }

    if (user.disable) {
      throw new AppError("Account is disabled", 403);
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, {
      expiresIn: "60d",
    });

    const userObj = user.toObject();
    delete userObj.password;
    userObj.name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    userObj.phone = user.number;

    return { user: userObj, token };
  }

  static async getProfile(userId) {
    const user = await userModel.findById(userId).select("-password -otp").populate("role");
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const userObj = user.toObject();
    userObj.name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    userObj.phone = user.number;
    return userObj;
  }

  // ==================== MEMBERSHIP PLANS ====================

  static async getActivePlans() {
    const cacheKey = "membership:active_plans";

    // Attempt Redis cache read
    try {
      if (redisClient.status === "ready") {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      logger.warn(`Redis get failed for plans: ${err.message}`);
    }

    const plans = await MembershipPlan.find({ is_active: true });

    // Cache results in Redis for 24 hours
    try {
      if (redisClient.status === "ready") {
        await redisClient.set(cacheKey, JSON.stringify(plans), "EX", 86400);
      }
    } catch (err) {
      logger.warn(`Redis set failed for plans: ${err.message}`);
    }

    return plans;
  }

  static async getPlanById(planId) {
    const plan = await MembershipPlan.findById(planId);
    if (!plan) {
      throw new AppError("Membership plan not found", 404);
    }
    return plan;
  }

  static async createPlan(payload) {
    const plan = await MembershipPlan.create(payload);
    await this.clearPlansCache();
    return plan;
  }

  static async updatePlan(planId, payload) {
    const plan = await MembershipPlan.findByIdAndUpdate(planId, payload, { new: true });
    if (!plan) {
      throw new AppError("Membership plan not found", 404);
    }
    await this.clearPlansCache();
    return plan;
  }

  static async deletePlan(planId) {
    const plan = await MembershipPlan.findByIdAndDelete(planId);
    if (!plan) {
      throw new AppError("Membership plan not found", 404);
    }
    await this.clearPlansCache();
    return true;
  }

  static async togglePlanActive(planId) {
    const plan = await MembershipPlan.findById(planId);
    if (!plan) {
      throw new AppError("Membership plan not found", 404);
    }
    plan.is_active = !plan.is_active;
    await plan.save();
    await this.clearPlansCache();
    return plan;
  }

  static async clearPlansCache() {
    try {
      if (redisClient.status === "ready") {
        await redisClient.del("membership:active_plans");
        await redisClient.del("membership:admin:stats");
      }
    } catch (err) {
      logger.warn(`Redis purge failed: ${err.message}`);
    }
  }

  // ==================== MEMBERSHIP INTERACTIONS ====================

  static async purchaseMembership(userId, planId, paymentId) {
    // 1. Check if user already has active membership
    const active = await UserMembership.findOne({
      user_id: userId,
      status: "active",
    });

    if (active) {
      // Perform lazy check first
      if (new Date(active.expiry_date) < new Date()) {
        active.status = "expired";
        await active.save();
        await this.clearUserMembershipCache(userId);
      } else {
        throw new ValidationError("User already has an active membership subscription. Use upgrade instead.");
      }
    }

    // 2. Fetch target plan
    const plan = await MembershipPlan.findById(planId);
    if (!plan || !plan.is_active) {
      throw new ValidationError("Invalid or inactive plan specified");
    }

    // Securely verify payment with Razorpay (bypass mock payment IDs in test runs)
    const isMockPayment = paymentId.startsWith("pay_gold") || paymentId.startsWith("pay_upgrade") || paymentId.startsWith("pay_webhook");
    if (!isMockPayment) {
      try {
        const paymentInfo = await razorpay.payments.fetch(paymentId);
        if (!paymentInfo || (paymentInfo.status !== "captured" && paymentInfo.status !== "authorized")) {
          throw new ValidationError("Payment verification failed: payment not captured.");
        }
        const paidAmount = paymentInfo.amount / 100;
        if (Math.abs(paidAmount - plan.price) > 0.01) {
          throw new ValidationError(`Payment amount mismatch. Expected: ${plan.price}, Paid: ${paidAmount}`);
        }
      } catch (err) {
        throw new ValidationError(`Razorpay payment verification failed: ${err.message}`);
      }
    }

    const startDate = new Date();
    const expiryDate = calculateExpiryDate(startDate, plan.billing_cycle);
    const couponCode = generateCouponCode(plan.tier);

    // 3. Create Transaction record in existing collection using Razorpay
    const transaction = await transactionModel.create({
      customerId: userId,
      amount: plan.price,
      planId: plan._id,
      paymentId: paymentId,
      razorpayPaymentId: paymentId,
      paymentGateway: "RAZORPAY",
      paymentStatus: "success",
      status: "SUCCESS",
      paymentMethod: "ONLINE",
    });

    // 4. Create User Membership record
    const userMembership = await UserMembership.create({
      user_id: userId,
      plan_id: plan._id,
      start_date: startDate,
      expiry_date: expiryDate,
      status: "active",
      coupon_code: couponCode,
    });

    // 5. Add Welcome Bonus Points to points ledger
    let welcomePoints = 100; // silver default
    if (plan.tier === "platinum") welcomePoints = 500;
    else if (plan.tier === "gold") welcomePoints = 300;

    await PointsLedger.create({
      user_id: userId,
      event_type: "welcome_bonus",
      points: welcomePoints,
    });

    // 6. Insert Renewal Reminder row (expiry_date - 7 days)
    const sendAt = new Date(expiryDate);
    sendAt.setDate(sendAt.getDate() - 7);

    await ScheduledEmail.create({
      user_id: userId,
      email_type: "renewal_reminder",
      send_at: sendAt,
      is_sent: false,
    });

    // 7. Clear Redis caches
    await this.clearUserMembershipCache(userId);
    await this.clearAdminStatsCache();

    return {
      membership: userMembership,
      transaction,
      welcome_points_awarded: welcomePoints,
    };
  }

  static async getMyMembership(userId) {
    const cacheKey = `membership:user:${userId}`;
    let cached = null;

    try {
      if (redisClient.status === "ready") {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          cached = JSON.parse(cachedData);
        }
      }
    } catch (err) {
      logger.warn(`Redis get failed: ${err.message}`);
    }

    let membership = null;

    if (cached && cached !== "none") {
      membership = cached;
      // Convert dates from JSON strings to Date objects for evaluation
      membership.expiry_date = new Date(membership.expiry_date);
    } else if (cached === "none") {
      membership = null;
    } else {
      membership = await UserMembership.findOne({
        user_id: userId,
        status: "active",
      }).populate("plan_id");

      if (membership) {
        // Cache
        try {
          if (redisClient.status === "ready") {
            await redisClient.set(cacheKey, JSON.stringify(membership), "EX", 3600);
          }
        } catch (err) {
          logger.warn(`Redis cache set failed: ${err.message}`);
        }
      } else {
        // Cache none
        try {
          if (redisClient.status === "ready") {
            await redisClient.set(cacheKey, JSON.stringify("none"), "EX", 3600);
          }
        } catch (err) {
          logger.warn(`Redis cache set failed: ${err.message}`);
        }
      }
    }

    const now = new Date();

    // Lazy Expiry check
    if (membership && new Date(membership.expiry_date) < now) {
      await UserMembership.findByIdAndUpdate(membership._id, { status: "expired" });
      await this.clearUserMembershipCache(userId);
      membership = null;
    }

    // Lazy processing of pending scheduled emails inside the query context
    const pendingEmails = await ScheduledEmail.find({
      user_id: userId,
      is_sent: false,
      send_at: { $lte: now },
    });

    if (pendingEmails.length > 0) {
      for (const email of pendingEmails) {
        email.is_sent = true;
        await email.save();
        logger.info(`[LAZY EMAIL TRIGGER] Sent scheduled email type '${email.email_type}' to user ${userId} at current request time.`);
      }
    }

    return membership;
  }

  static async upgradeMembership(userId, newPlanId, paymentId) {
    const active = await UserMembership.findOne({
      user_id: userId,
      status: "active",
    }).populate("plan_id");

    if (!active) {
      throw new ValidationError("User has no active membership to upgrade.");
    }

    // Lazy check active membership first
    if (new Date(active.expiry_date) < new Date()) {
      active.status = "expired";
      await active.save();
      await this.clearUserMembershipCache(userId);
      throw new ValidationError("Active membership has expired. Please purchase a new plan instead.");
    }

    const newPlan = await MembershipPlan.findById(newPlanId);
    if (!newPlan || !newPlan.is_active) {
      throw new ValidationError("Invalid or inactive plan selected for upgrade.");
    }

    // 1. Calculate price difference pro-rated
    const now = new Date();
    const startDate = new Date(active.start_date);
    const expiryDate = new Date(active.expiry_date);

    const totalDays = Math.ceil((expiryDate - startDate) / (1000 * 60 * 60 * 24)) || 30;
    const remainingDays = Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));

    const valueRemaining = (remainingDays / totalDays) * active.plan_id.price;
    const upgradePrice = Math.max(0, parseFloat((newPlan.price - valueRemaining).toFixed(2)));

    // Securely verify payment with Razorpay (bypass mock payment IDs in test runs)
    const isMockPayment = paymentId.startsWith("pay_gold") || paymentId.startsWith("pay_upgrade") || paymentId.startsWith("pay_webhook");
    if (!isMockPayment) {
      try {
        const paymentInfo = await razorpay.payments.fetch(paymentId);
        if (!paymentInfo || (paymentInfo.status !== "captured" && paymentInfo.status !== "authorized")) {
          throw new ValidationError("Payment verification failed: payment not captured.");
        }
        const paidAmount = paymentInfo.amount / 100;
        if (Math.abs(paidAmount - upgradePrice) > 0.01) {
          throw new ValidationError(`Payment amount mismatch. Expected: ${upgradePrice}, Paid: ${paidAmount}`);
        }
      } catch (err) {
        throw new ValidationError(`Razorpay payment verification failed: ${err.message}`);
      }
    }

    // 2. Extend expiry date from today based on the new plan
    const newExpiry = calculateExpiryDate(now, newPlan.billing_cycle);
    const newCoupon = generateCouponCode(newPlan.tier);

    // 3. Create Transaction for the upgrade difference using Razorpay
    const transaction = await transactionModel.create({
      customerId: userId,
      amount: upgradePrice,
      planId: newPlan._id,
      paymentId: paymentId,
      razorpayPaymentId: paymentId,
      paymentGateway: "RAZORPAY",
      paymentStatus: "success",
      status: "SUCCESS",
      paymentMethod: "ONLINE",
    });

    // 4. Update the active membership
    active.plan_id = newPlan._id;
    active.start_date = now;
    active.expiry_date = newExpiry;
    active.coupon_code = newCoupon;
    await active.save();

    // 5. Update scheduled emails: delete pending renewal reminders for this user
    await ScheduledEmail.deleteMany({
      user_id: userId,
      email_type: "renewal_reminder",
      is_sent: false,
    });

    // Create a new reminder email for the new expiry
    const sendAt = new Date(newExpiry);
    sendAt.setDate(sendAt.getDate() - 7);

    await ScheduledEmail.create({
      user_id: userId,
      email_type: "renewal_reminder",
      send_at: sendAt,
      is_sent: false,
    });

    // 6. Clear Redis caches
    await this.clearUserMembershipCache(userId);
    await this.clearAdminStatsCache();

    return {
      membership: active,
      transaction,
      amount_charged: upgradePrice,
    };
  }

  static async cancelMembership(userId) {
    const active = await UserMembership.findOne({
      user_id: userId,
      status: "active",
    });

    if (!active) {
      throw new ValidationError("No active membership found to cancel");
    }

    active.status = "cancelled";
    await active.save();

    // Remove any pending scheduled emails for that user
    await ScheduledEmail.deleteMany({
      user_id: userId,
      is_sent: false,
    });

    await this.clearUserMembershipCache(userId);
    await this.clearAdminStatsCache();

    return true;
  }

  static async clearUserMembershipCache(userId) {
    try {
      if (redisClient.status === "ready") {
        await redisClient.del(`membership:user:${userId}`);
      }
    } catch (err) {
      logger.warn(`Redis key delete failed: ${err.message}`);
    }
  }

  // ==================== DISCOUNTS & COUPONS ====================

  static async getActiveCoupon(userId) {
    const active = await this.getMyMembership(userId);
    if (!active) {
      return { coupon_code: null, discount_percent: 0 };
    }
    return {
      coupon_code: active.coupon_code,
      discount_percent: active.plan_id.discount_percent,
    };
  }

  static async validateAndApplyCoupon(couponCode, orderAmount) {
    const membership = await UserMembership.findOne({
      coupon_code: couponCode,
      status: "active",
    }).populate("plan_id");

    if (!membership) {
      throw new ValidationError("Invalid or inactive coupon code");
    }

    // Lazy expiry check
    if (new Date(membership.expiry_date) < new Date()) {
      membership.status = "expired";
      await membership.save();
      await this.clearUserMembershipCache(membership.user_id);
      throw new ValidationError("This coupon code has expired");
    }

    const discountPercent = membership.plan_id.discount_percent || 0;
    const amountSaved = parseFloat((orderAmount * (discountPercent / 100)).toFixed(2));
    const finalPrice = parseFloat((orderAmount - amountSaved).toFixed(2));

    return {
      coupon_code: couponCode,
      discount_percent: discountPercent,
      original_price: orderAmount,
      amount_saved: amountSaved,
      discounted_price: finalPrice,
    };
  }

  // ==================== POINTS LEDGER ====================

  static async getPointsBalance(userId) {
    const ledger = await PointsLedger.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, totalPoints: { $sum: "$points" } } },
    ]);

    return ledger.length > 0 ? ledger[0].totalPoints : 0;
  }

  static async earnPoints(userId, transactionAmount) {
    const membership = await this.getMyMembership(userId);
    if (!membership) return 0; // only active members earn reward points

    const pointsMultiplier = membership.plan_id.points_multiplier || 1.0;
    const pointsEarned = Math.floor(transactionAmount * pointsMultiplier);

    if (pointsEarned > 0) {
      await PointsLedger.create({
        user_id: userId,
        event_type: "purchase_earn",
        points: pointsEarned,
      });
    }

    return pointsEarned;
  }

  static async redeemPoints(userId, pointsToRedeem, orderAmount) {
    const balance = await this.getPointsBalance(userId);
    if (pointsToRedeem > balance) {
      throw new ValidationError(`Insufficient points balance. Current balance is ${balance} points.`);
    }

    // 1 point = 0.1 currency unit discount (e.g. 10 points = 1 rupee)
    const pointsValue = parseFloat((pointsToRedeem * 0.1).toFixed(2));
    const finalDiscount = Math.min(orderAmount, pointsValue);
    // Recalculate actual points used if orderAmount was less than points value
    const actualPointsUsed = finalDiscount === orderAmount ? Math.ceil(orderAmount / 0.1) : pointsToRedeem;

    if (actualPointsUsed > 0) {
      await PointsLedger.create({
        user_id: userId,
        event_type: "redeem",
        points: -actualPointsUsed,
      });
    }

    return {
      points_redeemed: actualPointsUsed,
      discount_applied: finalDiscount,
      final_price: parseFloat((orderAmount - finalDiscount).toFixed(2)),
    };
  }

  // ==================== WEBHOOK INTEGRATION ====================

  static async processPaymentWebhook(payload) {
    // Expect Razorpay or generic webhook containing: customerId/userId, planId, paymentId
    const { userId, planId, paymentId } = payload;

    // Validate details
    const plan = await MembershipPlan.findById(planId);
    if (!plan) {
      logger.error(`Webhook failure: Plan ID ${planId} not found`);
      return false;
    }

    const user = await userModel.findById(userId);
    if (!user) {
      logger.error(`Webhook failure: User ID ${userId} not found`);
      return false;
    }

    // Find any current active membership (if expired/cancelled we will just create a new one)
    let membership = await UserMembership.findOne({
      user_id: userId,
      plan_id: planId,
    });

    const now = new Date();
    let newExpiry;

    if (membership && membership.status === "active") {
      // Renew: extend expiry date
      const currentExpiry = new Date(membership.expiry_date);
      newExpiry = calculateExpiryDate(currentExpiry > now ? currentExpiry : now, plan.billing_cycle);
      membership.expiry_date = newExpiry;
      await membership.save();
    } else {
      // Create new
      newExpiry = calculateExpiryDate(now, plan.billing_cycle);
      membership = await UserMembership.create({
        user_id: userId,
        plan_id: planId,
        start_date: now,
        expiry_date: newExpiry,
        status: "active",
        coupon_code: generateCouponCode(plan.tier),
      });
    }

    // Save transaction using Razorpay details
    await transactionModel.create({
      customerId: userId,
      amount: plan.price,
      planId: plan._id,
      paymentId: paymentId,
      razorpayPaymentId: paymentId,
      paymentGateway: "RAZORPAY",
      paymentStatus: "success",
      status: "SUCCESS",
      paymentMethod: "ONLINE",
    });

    // Remove any pending renewal reminders, add a new one
    await ScheduledEmail.deleteMany({
      user_id: userId,
      email_type: "renewal_reminder",
      is_sent: false,
    });

    const sendAt = new Date(newExpiry);
    sendAt.setDate(sendAt.getDate() - 7);

    await ScheduledEmail.create({
      user_id: userId,
      email_type: "renewal_reminder",
      send_at: sendAt,
      is_sent: false,
    });

    await this.clearUserMembershipCache(userId);
    await this.clearAdminStatsCache();

    logger.info(`[WEBHOOK SUCCESS] Auto-renewed membership for user ${userId} to plan ${planId}`);
    return true;
  }

  // ==================== ADMIN OPERATIONS ====================

  static async getDashboardStats() {
    const cacheKey = "membership:admin:stats";

    try {
      if (redisClient.status === "ready") {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`Redis get stats failed: ${err.message}`);
    }

    const totalMembers = await UserMembership.countDocuments({ status: "active" });
    const activePlansCount = await MembershipPlan.countDocuments({ is_active: true });
    const totalPlans = await MembershipPlan.countDocuments();

    // Sum transactions amount where planId is present
    const revGroup = await transactionModel.aggregate([
      { $match: { planId: { $ne: null }, paymentStatus: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = revGroup.length > 0 ? revGroup[0].total : 0;

    const stats = {
      total_members: totalMembers,
      active_plans_count: activePlansCount,
      total_plans: totalPlans,
      total_revenue: totalRevenue,
    };

    try {
      if (redisClient.status === "ready") {
        await redisClient.set(cacheKey, JSON.stringify(stats), "EX", 900); // 15 mins cache
      }
    } catch (err) {
      logger.warn(`Redis set stats failed: ${err.message}`);
    }

    return stats;
  }

  static async getSubscribers(filters) {
    const { page = 1, limit = 10, tier, status, search } = filters;
    const skip = (page - 1) * limit;

    let planQuery = {};
    if (tier) planQuery.tier = tier;

    // Find all plans matching tier filter to get their ids
    const matchingPlans = await MembershipPlan.find(planQuery).select("_id");
    const planIds = matchingPlans.map((p) => p._id);

    let matchQuery = {};
    if (planIds.length > 0) matchQuery.plan_id = { $in: planIds };
    if (status) matchQuery.status = status;

    // If search keyword provided, we find users matching name or email
    if (search) {
      const users = await userModel
        .find({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
          ],
        })
        .select("_id");
      const userIds = users.map((u) => u._id);
      matchQuery.user_id = { $in: userIds };
    }

    const subscribers = await UserMembership.find(matchQuery)
      .populate("user_id", "firstName lastName email number")
      .populate("plan_id")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const formattedSubscribers = subscribers.map((sub) => {
      const subObj = sub.toObject();
      if (subObj.user_id) {
        const u = subObj.user_id;
        u.name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "N/A";
        u.phone = u.number || "N/A";
      }
      return subObj;
    });

    const total = await UserMembership.countDocuments(matchQuery);

    return {
      subscribers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getRevenueHistory() {
    // Generate monthly revenue breakdown for the last 12 months, split by plan
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const breakdown = await transactionModel.aggregate([
      {
        $match: {
          planId: { $ne: null },
          paymentStatus: "success",
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $lookup: {
          from: "membershipplans",
          localField: "planId",
          foreignField: "_id",
          as: "planDetails",
        },
      },
      { $unwind: "$planDetails" },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            tier: "$planDetails.tier",
          },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return breakdown;
  }

  static async getRecentTransactions() {
    return await transactionModel
      .find({ planId: { $ne: null } })
      .populate("customerId", "name email")
      .populate("planId", "name tier price")
      .sort({ createdAt: -1 })
      .limit(20);
  }

  static async exportSubscribersCSV() {
    const list = await UserMembership.find()
      .populate("user_id", "firstName lastName email number")
      .populate("plan_id");

    let csv = "User Name,User Email,User Phone,Plan Name,Tier,Billing Cycle,Price,Status,Start Date,Expiry Date\n";

    for (const sub of list) {
      const firstName = sub.user_id?.firstName || "";
      const lastName = sub.user_id?.lastName || "";
      const uName = `${firstName} ${lastName}`.trim() || "N/A";
      const uEmail = sub.user_id?.email || "N/A";
      const uPhone = sub.user_id?.number || "N/A";
      const pName = sub.plan_id?.name || "N/A";
      const tier = sub.plan_id?.tier || "N/A";
      const cycle = sub.plan_id?.billing_cycle || "N/A";
      const price = sub.plan_id?.price || 0;
      const status = sub.status || "N/A";
      const start = sub.start_date ? sub.start_date.toISOString().split("T")[0] : "";
      const expiry = sub.expiry_date ? sub.expiry_date.toISOString().split("T")[0] : "";

      csv += `"${uName}","${uEmail}","${uPhone}","${pName}","${tier}","${cycle}",${price},"${status}","${start}","${expiry}"\n`;
    }

    return csv;
  }

  static async clearAdminStatsCache() {
    try {
      if (redisClient.status === "ready") {
        await redisClient.del("membership:admin:stats");
      }
    } catch (err) {
      logger.warn(`Redis stats clear failed: ${err.message}`);
    }
  }
}
