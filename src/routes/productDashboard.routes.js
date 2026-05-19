import { Router } from "express";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ProductDashboardController from "../controllers/productDashboard.controller.js";

const router = Router();

// ── Full product dashboard (all stats in one call) ───────────────────────────
// ?filter=month|today|last_7_days|all_time|2024
// &sortBy=unitsSold|revenue  &categoryId=<ObjectId>  &limit=10
router.get(
  "/products/dashboard",
  authUser,
  adminMiddleware,
  ProductDashboardController.getFullDashboard
);

// ── Individual widget endpoints (for partial refresh) ─────────────────────────

// Catalog KPI cards: totalProducts, trending, lowStock, outOfStock, inventoryValue
// ?filter=month|today|last_7_days|all_time|2024
router.get(
  "/products/dashboard/catalog",
  authUser,
  adminMiddleware,
  ProductDashboardController.getCatalogStats
);

// Sales cards: revenue, unitsSold, orders — current vs previous period
// ?filter=month|today|last_7_days|all_time|2024
router.get(
  "/products/dashboard/sales",
  authUser,
  adminMiddleware,
  ProductDashboardController.getSalesStats
);

// Top performers ranked with MoM % change
// ?filter=...  &sortBy=unitsSold|revenue  &categoryId=<ObjectId>  &limit=10
router.get(
  "/products/dashboard/top-performers",
  authUser,
  adminMiddleware,
  ProductDashboardController.getTopPerformers
);

// Daily revenue + units sold trend (chart data)
// ?filter=month|today|last_7_days|all_time|2024
router.get(
  "/products/dashboard/sales-trend",
  authUser,
  adminMiddleware,
  ProductDashboardController.getSalesTrend
);

// Out of stock products alert list
// ?limit=10
router.get(
  "/products/dashboard/out-of-stock",
  authUser,
  adminMiddleware,
  ProductDashboardController.getOutOfStock
);

export default router;
