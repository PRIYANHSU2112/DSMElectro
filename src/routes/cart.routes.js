// routes/cart.routes.js

import express from "express";
import CartController from "../controllers/cart.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/cart", authUser, CartController.addToCart);
router.get("/cart", authUser, CartController.getCart);
router.put("/cart/:id", authUser, CartController.updateCart);
router.delete("/cart/:id", authUser, CartController.removeItem);
router.patch("/cart/:id/decrease", authUser, CartController.decrease);
router.delete("/cart", authUser, CartController.clearCart);

router.post("/cart/apply-coupon", authUser, CartController.applyCoupon);
router.delete("/cart/remove-coupon", authUser, CartController.removeCoupon);

export default router;