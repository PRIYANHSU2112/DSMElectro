import express from "express";
import BuyNowController from "../controllers/buyNow.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST /buy-now  — create a single-item order
router.post("/buy-now", authUser, BuyNowController.createBuyNowOrder);

// POST /buy-now/verify-payment  — Razorpay callback
router.post("/buy-now/verify-payment", authUser, BuyNowController.verifyPayment);

export default router;