import express from "express";
import HotDealController from "../controllers/hotDeal.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ─── Admin Routes ────────────────────────────────────────────────────────────

// Create a new hot deal
router.post(
  "/hot-deal",
  authUser,
  adminMiddleware,
  HotDealController.create
);

// Update hot deal (title, dates, discount, isActive)
router.patch(
  "/hot-deal/:id",
  authUser,
  adminMiddleware,
  HotDealController.update
);

// Add products / variants / combos to an existing hot deal
router.patch(
  "/hot-deal/:id/add-items",
  authUser,
  adminMiddleware,
  HotDealController.addItems
);

// Remove products / variants / combos from an existing hot deal
router.patch(
  "/hot-deal/:id/remove-items",
  authUser,
  adminMiddleware,
  HotDealController.removeItems
);

// Get ALL hot deals (paginated + search)  ?page=1&limit=10&search=&status=active|inactive
router.get(
  "/hot-deals/all",
  authUser,
  adminMiddleware,
  HotDealController.getAll
);

// Get single hot deal with all its products, variants & combos populated
router.get(
  "/hot-deal/:id",
  authUser,
  adminMiddleware,
  HotDealController.getById
);

// Toggle hot deal active / inactive
router.patch(
  "/hot-deal/:id/toggle-status",
  authUser,
  adminMiddleware,
  HotDealController.toggleStatus
);

// ─── Public Routes ───────────────────────────────────────────────────────────

// Active hot deals for users  ?page=1&limit=10&search=keyword
router.get("/hot-deals", HotDealController.getActive);

export default router;
