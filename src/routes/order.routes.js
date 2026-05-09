// ── order.routes.js (updated) ────────────────────────────────────────────────
import express from "express";
import OrderController from "../controllers/order.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

router.post("/order", authUser, OrderController.createOrder);
router.post("/order/verify-payment", authUser, OrderController.verifyPayment);
router.get("/order", authUser, OrderController.getOrders);
router.get("/order/:id", authUser, OrderController.getOrderById);
router.patch("/order/:id/cancel", authUser, OrderController.cancelOrder);
router.patch("/order/:id/status", authUser, adminMiddleware, OrderController.updateStatus);

router.post(
  "/order/:id/return",
  authUser,
  ObjectStorageService.s3Uploader().fields([{ name: "media", maxCount: 3 }]),
  OrderController.requestReturn
);

router.patch(
  "/order/:id/return-status",
  authUser,
  adminMiddleware,
  OrderController.updateReturnStatus
);

export default router;