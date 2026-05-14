import express from "express";
import FlashSaleController from "../controllers/flashSale.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

//  Admin routes
router.post(
  "/flash-sale",
  authUser,
  adminMiddleware,
  FlashSaleController.create,
);

router.get(
  "/flash-sales/all",
  authUser,
  adminMiddleware,
  FlashSaleController.getAll, // (optional if you add it)
);

router.get(
  "/flash-sale/:id",
  authUser,
  adminMiddleware,
  FlashSaleController.getById, // (optional)
);

router.patch(
  "/flash-sale/:id/deactivate",
  authUser,
  adminMiddleware,
  FlashSaleController.deactivate,
);

router.patch(
  "/flash-sale/:id/add-items",
  authUser,
  adminMiddleware,
  FlashSaleController.addItems,
);

//  Public route
router.get("/flash-sales", FlashSaleController.getActive);

export default router;
