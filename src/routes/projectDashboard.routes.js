import { Router } from "express";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ProjectDashboardController from "../controllers/projectDashboard.controller.js";

const router = Router();

// ── Full project dashboard (all stats in one call) ───────────────────────────
// ?filter=month|today|last_7_days|all_time|2024
// &sortBy=downloads|views  &categoryId=<ObjectId>  &limit=10
router.get(
  "/projects/dashboard",
  authUser,
  adminMiddleware,
  ProjectDashboardController.getFullDashboard
);

// ── Individual widget endpoints (for partial refresh) ─────────────────────────

// Catalog cards: totalProjects, byLevel breakdown, disabled, catalogValue
// ?filter=month|today|last_7_days|all_time|2024
router.get(
  "/projects/dashboard/catalog",
  authUser,
  adminMiddleware,
  ProjectDashboardController.getCatalogStats
);

// Engagement cards: views, downloads, ratings — current vs previous period
// ?filter=month|today|last_7_days|all_time|2024
router.get(
  "/projects/dashboard/engagement",
  authUser,
  adminMiddleware,
  ProjectDashboardController.getEngagementStats
);

// Top performers ranked by downloads or views
// ?filter=...  &sortBy=downloads|views  &categoryId=<ObjectId>  &limit=10
router.get(
  "/projects/dashboard/top-performers",
  authUser,
  adminMiddleware,
  ProjectDashboardController.getTopPerformers
);

// Recently added projects
// ?limit=5
router.get(
  "/projects/dashboard/recent",
  authUser,
  adminMiddleware,
  ProjectDashboardController.getRecentProjects
);

// Latest user ratings across all projects
// ?limit=5
router.get(
  "/projects/dashboard/recent-ratings",
  authUser,
  adminMiddleware,
  ProjectDashboardController.getRecentRatings
);

export default router;
