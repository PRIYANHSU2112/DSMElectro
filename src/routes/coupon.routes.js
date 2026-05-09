import express from "express";
import CouponController from "../controllers/coupon.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public/User Routes
router.post("/coupon/validate", authUser, CouponController.validate);

// Admin Routes
router.post("/coupon", authUser, adminMiddleware, CouponController.create);
router.get("/coupon", authUser, adminMiddleware, CouponController.getAll);
router.put("/coupon/:id", authUser, adminMiddleware, CouponController.update);
router.delete("/coupon/:id", authUser, adminMiddleware, CouponController.delete);

export default router;
