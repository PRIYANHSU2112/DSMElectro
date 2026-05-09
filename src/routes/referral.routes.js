import express from "express";
import ReferralController from "../controllers/referral.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.get("/referral/link", authUser, ReferralController.getLink);
router.get("/referral/my", authUser, ReferralController.getMyReferrals);

export default router
