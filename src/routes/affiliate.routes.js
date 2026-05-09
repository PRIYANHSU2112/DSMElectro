import express from "express";
import AffiliateController from "../controllers/affiliate.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

// send OTP to phone
router.post("/affiliate/send-otp", AffiliateController.sendOtp);

// verify OTP → returns userId
router.post("/affiliate/verify-otp", AffiliateController.verifyOtp);

// frontend calls this silently when a referral link is visited
// GET /api/affiliate/click/AFF-A3X9K2?type=product&itemId=xxx

router.post("/affiliate/click/:affiliateCode", AffiliateController.trackClick);
// validate a referral code (used on product pages to show affiliate name)

router.get(
  "/affiliate/validate/:affiliateCode",
  AffiliateController.resolveAffiliate,
);

//  AUTHENTICATED USER ROUTES

// submit affiliate registration form + PAN image upload
router.post(
  "/affiliate/register",
  authUser,
  ObjectStorageService.s3Uploader().fields([{ name: "panImage", maxCount: 1 }]),
  AffiliateController.register,
);

// profile
router.get("/affiliate/me", authUser, AffiliateController.getMyProfile);

// wallet summary
router.get("/affiliate/me/wallet", authUser, AffiliateController.getMyWallet);

// full dashboard — ?days=7|14|30
router.get(
  "/affiliate/me/dashboard",
  authUser,
  AffiliateController.getDashboard,
);

// commission history — ?page=1&limit=10&itemType=product|combo|variant
router.get(
  "/affiliate/me/commissions",
  authUser,
  AffiliateController.getMyCommissions,
);

// request withdrawal
router.post(
  "/affiliate/me/withdraw",
  authUser,
  AffiliateController.requestWithdrawal,
);

// withdrawal history — ?page=1&limit=10&status=pending|processed|rejected
router.get(
  "/affiliate/me/withdrawals",
  authUser,
  AffiliateController.getMyWithdrawals,
);

//  ADMIN ROUTES

// list all withdrawal requests — ?status=pending|processed|rejected&method=upi|bank|dsm
router.get(
  "/affiliate/admin/withdrawals",
  authUser,
  adminMiddleware,
  AffiliateController.getAllWithdrawals,
);

// admin overview stats
router.get(
  "/affiliate/admin/stats",
  authUser,
  adminMiddleware,
  AffiliateController.getAdminStats,
);

router.get(
  "/affiliate/admin/list",
  authUser,
  adminMiddleware,
  AffiliateController.getAllAffiliates,
);

// single affiliate detail
router.get(
  "/affiliate/admin/:id",
  authUser,
  adminMiddleware,
  AffiliateController.getAffiliateById,
);

// set global default commission for all affiliates
router.patch(
  "/affiliate/admin/settings/commission",
  authUser,
  adminMiddleware,
  AffiliateController.setGlobalCommission,
);
// approve affiliate (auto-generates referral code)
router.patch(
  "/affiliate/admin/:id/approve",
  authUser,
  adminMiddleware,
  AffiliateController.approveAffiliate,
);

// reject affiliate
router.patch(
  "/affiliate/admin/:id/reject",
  authUser,
  adminMiddleware,
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
