import admin from "../utils/firebase.js";
import notificationModel from "../model/notification.model.js";
import userModel from "../model/user.model.js";


// ── Notification messages per order status ───────────────────────────────────
const ORDER_MESSAGES = {
  ORDER_PLACED: {
    title: "Order Placed! 🎉",
    body: (orderId) =>
      `Your order #${orderId} has been placed successfully. We'll keep you updated!`,
  },
  ORDER_SHIPPED: {
    title: "Order Shipped! 🚚",
    body: (orderId) =>
      `Your order #${orderId} is on its way! Track it in the app.`,
  },
  ORDER_ARRIVING: {
    title: "Out for Delivery! 📦",
    body: (orderId) => `Your order #${orderId} is arriving today. Be ready!`,
  },
  ORDER_DELIVERED: {
    title: "Delivered! ✅",
    body: (orderId) =>
      `Your order #${orderId} has been delivered. Enjoy your purchase!`,
  },
  ORDER_CANCELLED: {
    title: "Order Cancelled",
    body: (orderId) =>
      `Your order #${orderId} has been cancelled. Contact support if this was a mistake.`,
  },
};

// ── Map order model status → notification type ───────────────────────────────
const STATUS_TO_TYPE = {
  ORDERED: "ORDER_PLACED",
  SHIPPED: "ORDER_SHIPPED",
  ARRIVING: "ORDER_ARRIVING",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
};

export default class NotificationService {
  // ─── INTERNAL: send FCM push ───────────────────────────────────────────────
  static async _sendPush({ tokens, title, body, data = {} }) {
    if (!tokens || tokens.length === 0) return;

    // Filter out null/undefined tokens
    const validTokens = tokens.filter(Boolean);
    if (validTokens.length === 0) return;

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: validTokens,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)]),
        ),
      });

      response.responses.forEach((r, i) => {
        if (!r.success) {
          console.error(`FCM failed for token[${i}]:`, r.error?.message);
        }
      });
    } catch (err) {
      // Never throw — notification failure should never crash the order flow
      console.error("FCM send error:", err.message);
    }
  }

  // ─── INTERNAL: save in-app + push ─────────────────────────────────────────
  static async _notify({ userId, title, message, type, orderId, fcmToken }) {
    try {
      // 1. Save in-app notification
      await notificationModel.create({
        userId,
        title,
        message,
        type,
        orderId: orderId ? String(orderId) : null,
        seen: false,
        date: new Date(),
        userType: "USER",
      });

      // 2. Push (fire-and-forget)
      if (fcmToken) {
        NotificationService._sendPush({
          tokens: [fcmToken],
          title,
          body: message,
          data: { orderId: String(orderId ?? ""), type },
        });
      }
    } catch (err) {
      console.error("Notification save error:", err.message);
    }
  }

  // ─── PUBLIC: notify user when order is placed ──────────────────────────────
  /**
   * Called from OrderService.createOrder and BuyNowService.createBuyNowOrder
   * after the order is committed.
   *
   * @param {ObjectId} userId
   * @param {ObjectId} orderId
   */
  static async notifyOrderPlaced(userId, orderId) {
    const user = await userModel.findById(userId).select("fcmToken").lean();
    const msg = ORDER_MESSAGES.ORDER_PLACED;

    await NotificationService._notify({
      userId,
      title: msg.title,
      message: msg.body(orderId),
      type: "ORDER_PLACED",
      orderId,
      fcmToken: user?.fcmToken ?? null,
    });
  }

  // ─── PUBLIC: notify user when order status changes ─────────────────────────
  /**
   * Called from OrderService.updateStatus (admin panel action).
   *
   * @param {object} order   — populated order document (must have customerId)
   * @param {string} status  — new order status (SHIPPED / ARRIVING / DELIVERED / CANCELLED)
   */
  static async notifyOrderStatusUpdate(order, status) {
    const type = STATUS_TO_TYPE[status];
    if (!type || type === "ORDER_PLACED") return; // ORDER_PLACED is handled separately

    const template = ORDER_MESSAGES[type];
    if (!template) return;

    const userId = order.customerId?._id ?? order.customerId;
    const user = await userModel.findById(userId).select("fcmToken").lean();

    await NotificationService._notify({
      userId,
      title: template.title,
      message: template.body(order._id),
      type,
      orderId: order._id,
      fcmToken: user?.fcmToken ?? null,
    });
  }

  // ─── PUBLIC: send to a single user (admin-triggered) ──────────────────────
  static async sendToUser(
    userId,
    { title, message, type = "GENERAL", orderId = null },
  ) {
    const user = await userModel.findById(userId).select("fcmToken").lean();
    if (!user) throw new Error("User not found");

    await NotificationService._notify({
      userId,
      title,
      message,
      type,
      orderId,
      fcmToken: user?.fcmToken ?? null,
    });
  }

  // ─── PUBLIC: broadcast to all users (admin-triggered) ─────────────────────
  static async sendToAllUsers({ title, message, type = "GENERAL" }) {
    // Dynamically find the User role, or exclude admin roles to find regular users.
    // This avoids casting errors with the String "USER" against the ObjectId field.
    const roleModel = userModel.db.model("Role");
    const userRole = await roleModel.findOne({ name: "User" }).lean();

    let query = { disable: { $ne: true } };
    if (userRole) {
      // Include users with the "User" role, or users who have no role assigned
      query.$or = [
        { role: userRole._id },
        { role: { $exists: false } },
        { role: null }
      ];
    } else {
      // Exclude admin/system roles
      const adminRoles = await roleModel.find({
        $or: [
          { name: "Super Admin" },
          { isSystemRole: true }
        ]
      }).select("_id").lean();

      const adminIds = adminRoles.map(r => r._id);
      if (adminIds.length > 0) {
        query.role = { $nin: adminIds };
      }
    }

    const users = await userModel
      .find(query)
      .select("_id fcmToken")
      .lean();

    const tokens = users.map((u) => u.fcmToken).filter(Boolean);

    // Batch in-app notifications
    const notifications = users.map((u) => ({
      userId: u._id,
      title,
      message,
      type,
      seen: false,
      date: new Date(),
      userType: "USER",
    }));

    if (notifications.length > 0) {
      await notificationModel.insertMany(notifications, { ordered: false });
    }

    // Send FCM in batches of 500 (FCM multicast limit)
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      NotificationService._sendPush({
        tokens: batch,
        title,
        body: message,
        data: { type },
      });
    }
  }

  // ─── PUBLIC: update FCM token for logged-in user ──────────────────────────
  static async updateFcmToken(userId, fcmToken) {
    await userModel.findByIdAndUpdate(userId, { fcmToken });
  }

  // ─── PUBLIC: get notifications for logged-in user (optimized) ─────────────
  static async getMyNotifications(userId, { page = 1, limit = 10, type } = {}) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter = { userId };
    if (type) filter.type = type;

    // Fetch primary notification data using compound index + lean()
    const data = await notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Smart Count Bypass: Avoid a second round-trip if page 1 results fit entirely within the limit
    let total;
    if (pageNum === 1 && data.length < limitNum) {
      total = data.length;
    } else {
      total = await notificationModel.countDocuments(filter);
    }

    // Redundant Write Elimination: Only trigger the background update if there are actual unseen items in this batch
    const hasUnseen = data.some((n) => !n.seen);
    if (hasUnseen) {
      notificationModel.updateMany(
        { userId, seen: false },
        { $set: { seen: true } }
      ).catch((err) => console.error("[NotificationService] Background seen update failed:", err.message));
    }

    return {
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
      },
    };
  }

  // ─── PUBLIC: get unseen count for logged-in user (optimized) ──────────────
  static async getUnseenCount(userId) {
    const count = await notificationModel.countDocuments({
      userId,
      seen: false,
    });
    return { count };
  }

  // ─── PUBLIC: mark single notification as seen ──────────────────────────────
  static async markSeen(notificationId, userId) {
    const notification = await notificationModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { seen: true } },
      { new: true }
    );
    if (!notification) {
      throw new Error("Notification not found");
    }
    return notification;
  }

  // ─── PUBLIC: mark ALL user's notifications as seen ────────────────────────
  static async markAllSeen(userId) {
    await notificationModel.updateMany(
      { userId, seen: false },
      { $set: { seen: true } }
    );
    return true;
  }

  // ─── PUBLIC: ADMIN: get all notifications (optimized pagination) ──────────
  static async getAllNotifications({ page = 1, limit = 10, userId, type } = {}) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (userId) filter.userId = userId;
    if (type) filter.type = type;

    const data = await notificationModel
      .find(filter)
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Smart Count Bypass for Admin panel
    let total;
    if (pageNum === 1 && data.length < limitNum) {
      total = data.length;
    } else {
      total = await notificationModel.countDocuments(filter);
    }

    return {
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}

