import express from "express";
import NotificationController from "../controllers/notification.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ── User Endpoints (Authenticated) ──────────────────────────────────────────
// POST /api/v1/notification/fcm-token
router.post("/notification/fcm-token", authUser, NotificationController.updateFcmToken);

// GET /api/v1/notification/my
router.get("/notification/my", authUser, NotificationController.getMyNotifications);

// GET /api/v1/notification/unseen-count
router.get("/notification/unseen-count", authUser, NotificationController.getUnseenCount);

// PATCH /api/v1/notification/mark-all-seen
router.patch("/notification/mark-all-seen", authUser, NotificationController.markAllSeen);

// PATCH /api/v1/notification/:id/seen
router.patch("/notification/:id/seen", authUser, NotificationController.markSeen);

// ── Admin Endpoints (Authenticated & Super Admin/System Role Only) ───────────
// GET /api/v1/notification/admin/all
router.get("/notification/admin/all", authUser, adminMiddleware, NotificationController.getAllNotifications);

// POST /api/v1/notification/admin/send-to-user
router.post("/notification/admin/send-to-user", authUser, adminMiddleware, NotificationController.sendToUser);

// POST /api/v1/notification/admin/broadcast
router.post("/notification/admin/broadcast", authUser, adminMiddleware, NotificationController.broadcast);

export default router;