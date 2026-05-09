import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ["ORDER", "CANCELLATION"],
      default: "ORDER",
    },
    paymentStatus: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    totals: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      couponDiscount: { type: Number, default: 0 },
      shippingCharge: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },
    taxes: [
      {
        name: String,   // e.g. "CGST @ 9%"
        rate: Number,   // e.g. 9
        amount: Number, // e.g. 315
      },
    ],
    metadata: {
      cancellationReason: String,
      paymentMethod: String,
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ orderId: 1, invoiceType: 1 });

export default mongoose.model("invoice", invoiceSchema);
