import express from "express";
import AffiliateController from "../controllers/affiliate.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

// ── PUBLIC ────────────────────────────────────────────────────────────────────

router.post("/affiliate/send-otp", AffiliateController.sendOtp);
router.post("/affiliate/verify-otp", AffiliateController.verifyOtp);

// track referral click — GET /api/v1/affiliate/click/AFF-A3X9K2?type=product&itemId=xxx
router.post("/affiliate/click/:affiliateCode", AffiliateController.trackClick);

// validate a referral code (used on product pages to show affiliate name)
router.get("/affiliate/validate/:affiliateCode", AffiliateController.resolveAffiliate);

// ── AUTHENTICATED USER ROUTES ─────────────────────────────────────────────────

router.post(
  "/affiliate/register",
  authUser,
  ObjectStorageService.s3Uploader().fields([
    { name: "panImage",   maxCount: 1 },
    { name: "adharImage", maxCount: 1 },
  ]),
  AffiliateController.register,
);

router.get("/affiliate/me",              authUser, AffiliateController.getMyProfile);
router.get("/affiliate/me/wallet",       authUser, AffiliateController.getMyWallet);
router.get("/affiliate/me/dashboard",    authUser, AffiliateController.getDashboard);
router.get("/affiliate/me/commissions",  authUser, AffiliateController.getMyCommissions);
router.post("/affiliate/me/withdraw",    authUser, AffiliateController.requestWithdrawal);
router.get("/affiliate/me/withdrawals",  authUser, AffiliateController.getMyWithdrawals);
router.get("/affiliate/me/tiers",        authUser, AffiliateController.getActiveTiers);

// ── ADMIN — STATIC NAMED ROUTES (must come BEFORE /admin/:id) ─────────────────

router.get(
  "/affiliate/admin/withdrawals",
  authUser, adminMiddleware,
  AffiliateController.getAllWithdrawals,
);

router.get(
  "/affiliate/admin/stats",
  authUser, adminMiddleware,
  AffiliateController.getAdminStats,
);

router.get(
  "/affiliate/admin/dashboard-overview",
  authUser, adminMiddleware,
  AffiliateController.getAdminDashboardOverview,
);

// Referral Tracking Dashboard — ?days=14&page=1&limit=10
router.get(
  "/affiliate/admin/referral-tracking",
  authUser, adminMiddleware,
  AffiliateController.getReferralTrackingDashboard,
);

router.get(
  "/affiliate/admin/list",
  authUser, adminMiddleware,
  AffiliateController.getAllAffiliates,
);

// ── ADMIN — TIER ROUTES ───────────────────────────────────────────────────────

router.post(
  "/affiliate/admin/tiers",
  authUser, adminMiddleware,
  AffiliateController.createTier,
);

router.get(
  "/affiliate/admin/tiers",
  authUser, adminMiddleware,
  AffiliateController.getAllTiers,
);

router.patch(
  "/affiliate/admin/tiers/:id",
  authUser, adminMiddleware,
  AffiliateController.updateTier,
);

router.delete(
  "/affiliate/admin/tiers/:id",
  authUser, adminMiddleware,
  AffiliateController.deleteTier,
);

// Global commission setting — must be BEFORE /admin/:id
router.patch(
  "/affiliate/admin/settings/commission",
  authUser, adminMiddleware,
  AffiliateController.setGlobalCommission,
);

// Withdrawal approve/reject — must be BEFORE /admin/:id
router.patch(
  "/affiliate/admin/withdrawals/:id",
  authUser, adminMiddleware,
  AffiliateController.processWithdrawal,
);

// ── ADMIN — WILDCARD /:id (must be LAST among /admin/* routes) ───────────────

// single affiliate detail
router.get(
  "/affiliate/admin/:id",
  authUser, adminMiddleware,
  AffiliateController.getAffiliateById,
);

// approve affiliate (auto-generates referral code)
router.patch(
  "/affiliate/admin/:id/approve",
  authUser, adminMiddleware,
  AffiliateController.approveAffiliate,
);

// reject affiliate
router.patch(
  "/affiliate/admin/:id/reject",
  authUser, adminMiddleware,
  AffiliateController.rejectAffiliate,
);

router.patch(
  "/affiliate/admin/:id/commission",
  authUser,
  adminMiddleware,
  AffiliateController.setAffiliateCommission,
);

// approve or reject a withdrawal request
router.patch(
  "/affiliate/admin/withdrawals/:id",
  authUser,
  adminMiddleware,
  AffiliateController.processWithdrawal,
);


export default router;
