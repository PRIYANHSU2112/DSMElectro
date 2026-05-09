import { handleApiRequest, AppError } from "../utils/apiResponse.js";
import NotificationService from "../services/notificationService.js";
import notificationModel from "../model/notification.model.js";

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
      const { page = 1, limit = 10, type } = req.query;
      const pageNum  = parseInt(page);
      const limitNum = parseInt(limit);
      const skip     = (pageNum - 1) * limitNum;

      const filter = { userId: req.user._id };
      if (type) filter.type = type;

      const [data, total] = await Promise.all([
        notificationModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        notificationModel.countDocuments(filter),
      ]);

      // Mark all as seen
      await notificationModel.updateMany(
        { userId: req.user._id, seen: false },
        { $set: { seen: true } },
      );

      return [
        {
          data,
          pagination: {
            total,
            page:       pageNum,
            limit:      limitNum,
            totalPages: Math.ceil(total / limitNum),
            hasNext:    pageNum < Math.ceil(total / limitNum),
            hasPrev:    pageNum > 1,
          },
        },
        "Notifications fetched",
      ];
    });
  }

  // ── Get unseen count for logged-in user ───────────────────────────────────
  // GET /notification/unseen-count
  static async getUnseenCount(req, res) {
    return handleApiRequest(req, res, async () => {
      const count = await notificationModel.countDocuments({
        userId: req.user._id,
        seen:   false,
      });
      return [{ data: { count } }, "Unseen count fetched"];
    });
  }

  // ── Mark single notification as seen ──────────────────────────────────────
  // PATCH /notification/:id/seen
  static async markSeen(req, res) {
    return handleApiRequest(req, res, async () => {
      const notification = await notificationModel.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { $set: { seen: true } },
        { new: true },
      );
      if (!notification) throw new AppError("Notification not found", 404);
      return [{ data: notification }, "Marked as seen"];
    });
  }

  // ── Mark ALL as seen ──────────────────────────────────────────────────────
  // PATCH /notification/mark-all-seen
  static async markAllSeen(req, res) {
    return handleApiRequest(req, res, async () => {
      await notificationModel.updateMany(
        { userId: req.user._id, seen: false },
        { $set: { seen: true } },
      );
      return [{}, "All notifications marked as seen"];
    });
  }

  // ── ADMIN: Get all notifications (paginated) ──────────────────────────────
  // GET /notification/admin/all?page=1&limit=10
  static async getAllNotifications(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page = 1, limit = 10, userId, type } = req.query;
      const pageNum  = parseInt(page);
      const limitNum = parseInt(limit);
      const skip     = (pageNum - 1) * limitNum;

      const filter = {};
      if (userId) filter.userId = userId;
      if (type)   filter.type   = type;

      const [data, total] = await Promise.all([
        notificationModel
          .find(filter)
          .populate("userId", "firstName lastName email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        notificationModel.countDocuments(filter),
      ]);

      return [
        {
          data,
          pagination: {
            total,
            page:       pageNum,
            limit:      limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        "Notifications fetched",
      ];
    });
  }

  // ── ADMIN: Send notification to a single user ─────────────────────────────
  // POST /notification/admin/send-to-user
  // Body: { userId, title, message, type? }
  static async sendToUser(req, res) {
    return handleApiRequest(req, res, async () => {
      const { userId, title, message, type } = req.body;
      if (!userId)  throw new AppError("userId is required", 400);
      if (!title)   throw new AppError("title is required", 400);
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
      if (!title)   throw new AppError("title is required", 400);
      if (!message) throw new AppError("message is required", 400);

      await NotificationService.sendToAllUsers({ title, message, type });
      return [{}, "Broadcast sent successfully"];
    });
  }
}