import express from "express";
import MembershipController from "../controllers/membership.controller.js";
import {
  authenticateMembershipUser,
  requireActiveMembership,
  requireAdmin,
} from "../middlewares/membershipAuth.middleware.js";

const router = express.Router();

// ==================== PROFILE & MEMBERSHIP (PROTECTED USER ROUTE) ====================

// Get my membership (lazy expiration evaluation & emails processing happen here)
router.get("/my-membership", authenticateMembershipUser, MembershipController.getMyMembership);

// Purchase plan
router.post("/purchase", authenticateMembershipUser, MembershipController.purchaseMembership);

// Upgrade membership (calculates pro-rated pricing difference, extends expiry)
router.post("/upgrade", authenticateMembershipUser, MembershipController.upgradeMembership);

// Cancel membership (sets cancelled status, purges pending emails)
router.post("/cancel", authenticateMembershipUser, MembershipController.cancelMembership);

// ==================== DISCOUNT & COUPONS (PROTECTED USER ROUTE) ====================
// Get my active coupon code
router.get("/coupon", authenticateMembershipUser, MembershipController.getActiveCoupon);

// Validate and apply coupon code to order
router.post("/coupon/validate", authenticateMembershipUser, MembershipController.validateCoupon);

// ==================== POINTS LEDGER (PROTECTED USER ROUTE) ====================
// Get my aggregated points balance
router.get("/points/balance", authenticateMembershipUser, MembershipController.getPointsBalance);

// Earn points on successful transaction
router.post("/points/earn", authenticateMembershipUser, MembershipController.earnPoints);

// Redeem points against an order
router.post("/points/redeem", authenticateMembershipUser, MembershipController.redeemPoints);

// ==================== PLANS (PUBLIC ACCESS) ====================
// Get all active plans (Redis cached)
router.get("/plans", MembershipController.getActivePlans);

// Get single plan by ID
router.get("/plans/:id", MembershipController.getPlanById);

// ==================== PAYMENT WEBHOOK (PUBLIC WEBHOOK) ====================
router.post("/webhook/payment", MembershipController.processPaymentWebhook);

// ==================== ADMIN OPERATIONS (PROTECTED ADMIN ROUTE) ====================
// Admin create, edit, delete, toggle active status of plans
router.post("/admin/plans", authenticateMembershipUser, requireAdmin, MembershipController.createPlan);
router.put("/admin/plans/:id", authenticateMembershipUser, requireAdmin, MembershipController.updatePlan);
router.delete("/admin/plans/:id", authenticateMembershipUser, requireAdmin, MembershipController.deletePlan);
router.patch("/admin/plans/:id/toggle", authenticateMembershipUser, requireAdmin, MembershipController.togglePlanActive);

// Admin dashboard stats (total members, active plans count, total revenue, total plans)
router.get("/admin/stats", authenticateMembershipUser, requireAdmin, MembershipController.getDashboardStats);

// Admin query subscribers list with pagination, search & status/tier filters
router.get("/admin/subscribers", authenticateMembershipUser, requireAdmin, MembershipController.getSubscribers);

// Admin subscribers list CSV export
router.get("/admin/subscribers/export", authenticateMembershipUser, requireAdmin, MembershipController.exportSubscribers);

// Admin monthly revenue history breakdown for last 12 months split by plan
router.get("/admin/revenue", authenticateMembershipUser, requireAdmin, MembershipController.getRevenueHistory);

// Admin recent transaction history
router.get("/admin/transactions", authenticateMembershipUser, requireAdmin, MembershipController.getRecentTransactions);

export default router;
