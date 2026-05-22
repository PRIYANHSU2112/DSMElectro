import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: "GENERAL",
      index: true,
    },
    orderId: {
      type: String,
      default: null,
    },
    seen: {
      type: Boolean,
      default: false,
      index: true,
    },
    userType: {
      type: String,
      default: "USER",
    },
  },
  { timestamps: true }
);

// Critical compound indexes for maximum performance, eliminating in-memory sorting
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, seen: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

const notificationModel = mongoose.model("notification", notificationSchema);

export default notificationModel;