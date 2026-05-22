import { handleApiRequest, AppError } from "../utils/apiResponse.js";
import NotificationService from "../services/notificationServices.js";

export default class NotificationController {

  // ── Update FCM token (called from app on login / token refresh) ────────────
  // POST /notification/fcm-token
  // Body: { fcmToken: "..." }
  static async updateFcmToken(req, res) {
    return handleApiRequest(req, res, async () => {
      const { fcmToken } = req.body;
      if (!fcmToken) throw new AppError("fcmToken is required", 400);

      await NotificationService.updateFcmToken(req.user._id, fcmToken);
      return [{}, "FCM token updated successfully"];
    });
  }

  // ── Get notifications for logged-in user ──────────────────────────────────
  // GET /notification/my?page=1&limit=10&type=ORDER_PLACED
  static async getMyNotifications(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page, limit, type } = req.query;
      const result = await NotificationService.getMyNotifications(req.user._id, { page, limit, type });
      return [result, "Notifications fetched successfully"];
    });
  }

  // ── Get unseen count for logged-in user ───────────────────────────────────
  // GET /notification/unseen-count
  static async getUnseenCount(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await NotificationService.getUnseenCount(req.user._id);
      return [result, "Unseen count fetched successfully"];
    });
  }

  // ── Mark single notification as seen ──────────────────────────────────────
  // PATCH /notification/:id/seen
  static async markSeen(req, res) {
    return handleApiRequest(req, res, async () => {
      try {
        const notification = await NotificationService.markSeen(req.params.id, req.user._id);
        return [notification, "Marked as seen successfully"];
      } catch (err) {
        throw new AppError(err.message, err.message === "Notification not found" ? 404 : 400);
      }
    });
  }

  // ── Mark ALL as seen ──────────────────────────────────────────────────────
  // PATCH /notification/mark-all-seen
  static async markAllSeen(req, res) {
    return handleApiRequest(req, res, async () => {
      await NotificationService.markAllSeen(req.user._id);
      return [{}, "All notifications marked as seen successfully"];
    });
  }

  // ── ADMIN: Get all notifications (paginated) ──────────────────────────────
  // GET /notification/admin/all?page=1&limit=10
  static async getAllNotifications(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page, limit, userId, type } = req.query;
      const result = await NotificationService.getAllNotifications({ page, limit, userId, type });
      return [result, "All notifications loaded successfully"];
    });
  }

  // ── ADMIN: Send notification to a single user ─────────────────────────────
  // POST /notification/admin/send-to-user
  // Body: { userId, title, message, type? }
  static async sendToUser(req, res) {
    return handleApiRequest(req, res, async () => {
      const { userId, title, message, type } = req.body;
      if (!userId) throw new AppError("userId is required", 400);
      if (!title) throw new AppError("title is required", 400);
      if (!message) throw new AppError("message is required", 400);

      await NotificationService.sendToUser(userId, { title, message, type });
      return [{}, "Notification sent successfully"];
    });
  }

  // ── ADMIN: Broadcast to all users ─────────────────────────────────────────
  // POST /notification/admin/broadcast
  // Body: { title, message, type? }
  static async broadcast(req, res) {
    return handleApiRequest(req, res, async () => {
      const { title, message, type } = req.body;
      if (!title) throw new AppError("title is required", 400);
      if (!message) throw new AppError("message is required", 400);

      await NotificationService.sendToAllUsers({ title, message, type });
      return [{}, "Broadcast sent successfully"];
    });
  }
}