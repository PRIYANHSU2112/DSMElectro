import { Router } from "express";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import DashboardController from "../controllers/dashboard.controller.js";

const router = Router();

// ── Full dashboard (all stats in one call) ──
router.get("/dashboard", authUser, adminMiddleware, DashboardController.getFullDashboard);

// ── Individual widget endpoints (for partial refresh) ──
router.get("/dashboard/products", authUser, adminMiddleware, DashboardController.getProductStats);
router.get("/dashboard/orders", authUser, adminMiddleware, DashboardController.getOrderStats);
router.get("/dashboard/revenue", authUser, adminMiddleware, DashboardController.getRevenueStats);
router.get("/dashboard/revenue-chart", authUser, adminMiddleware, DashboardController.getRevenueChart);
router.get("/dashboard/recent-orders", authUser, adminMiddleware, DashboardController.getRecentOrders);

export default router;
