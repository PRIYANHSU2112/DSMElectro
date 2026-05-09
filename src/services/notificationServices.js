import admin from "firebase-admin";
import { createRequire } from "module";
import notificationModel from "../model/notification.model.js";
import userModel from "../model/user.model.js";

// ── Firebase init (safe — only once) ────────────────────────────────────────
const require = createRequire(import.meta.url);

if (!admin.apps.length) {
  const serviceAccount = require("../../config/serviceAccount.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

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
    const users = await userModel
      .find({ role: "USER", disable: { $ne: true } })
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
}
