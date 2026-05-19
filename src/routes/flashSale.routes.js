import express from "express";
import FlashSaleController from "../controllers/flashSale.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// Create a new flash sale
router.post(
  "/flash-sale",
  authUser,
  adminMiddleware,
  FlashSaleController.create
);

// Update flash sale (title, dates, discount, isActive)
router.patch(
  "/flash-sale/:id",
  authUser,
  adminMiddleware,
  FlashSaleController.update
);

// Add products / variants / combos to a flash sale
router.patch(
  "/flash-sale/:id/add-items",
  authUser,
  adminMiddleware,
  FlashSaleController.addItems
);

// Remove products / variants / combos from a flash sale
router.patch(
  "/flash-sale/:id/remove-items",
  authUser,
  adminMiddleware,
  FlashSaleController.removeItems
);

// Toggle flash sale active / inactive
router.patch(
  "/flash-sale/:id/toggle-status",
  authUser,
  adminMiddleware,
  FlashSaleController.toggleStatus
);

// Get ALL flash sales (paginated + search)  ?page=1&limit=10&search=&status=active|inactive
router.get(
  "/flash-sales/all",
  authUser,
  adminMiddleware,
  FlashSaleController.getAll
);

// Get single flash sale with all items populated
router.get(
  "/flash-sale/:id",
  authUser,
  adminMiddleware,
  FlashSaleController.getById
);

// ─── Public Routes ────────────────────────────────────────────────────────────

// Active flash sales for users  ?page=1&limit=10&search=keyword
router.get("/flash-sales", FlashSaleController.getActive);

export default router;
