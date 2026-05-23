import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Types.ObjectId,
      ref: "order",
      default: null,
    },

    customerId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
    },

    amount: Number,

    currency: {
      type: String,
      default: "INR",
    },

    paymentGateway: {
      type: String,
      enum: ["RAZORPAY"],
    },

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    paymentMethod: {
      type: String,
      enum: ["UPI", "CARD", "NETBANKING", "WALLET", "COD", "ONLINE"],
    },

    status: {
      type: String,
      enum: ["CREATED", "SUCCESS", "FAILED", "REFUNDED", "PENDING"],
      default: "PENDING",
    },

    walletType: {
      type: String,
      enum: ["CREDIT", "DEBIT", null],
      default: null,
    },

    walletPurpose: {
      type: String,
      enum: ["TOPUP", "ORDER_PAYMENT", "REFUND", null],
      default: null,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPlan",
      default: null,
    },

    paymentId: {
      type: String,
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const transactionModel = mongoose.model(
  "transaction",
  transactionSchema
);

export default transactionModel;