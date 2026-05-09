import mongoose from "mongoose";

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

export const OrderStatus = {
  PENDING: "PENDING",
  ORDERED: "ORDERED",
  SHIPPED: "SHIPPED",
  ARRIVING: "ARRIVING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURN_APPROVED: "RETURN_APPROVED",
  RETURN_REJECTED: "RETURN_REJECTED",
  RETURNED: "RETURNED",
};

export const PaymentStatus = {
  PAID: "PAID",
  UNPAID: "UNPAID",
  FAILED: "FAILED",
};

// ── Single order line — supports variant OR combo ──────────────────────────
const orderItemSchema = new Schema(
  {
    productId: {
      type: ObjectId,
      ref: "product",
      default: null,
    },
    variantId: {
      type: ObjectId,
      ref: "variant",
      default: null,
    },
    comboId: {
      type: ObjectId,
      ref: "combo",
      default: null,
    },

    itemType: {
      type: String,
      enum: ["variant", "combo"],
      required: true,
      default: "variant",
    },

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    
    affiliateCode: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },

    indexStatus: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

// ── Order schema ───────────────────────────────────────────────────────────
const orderSchema = new Schema(
  {
    customerId: {
      type: ObjectId,
      ref: "user",
      required: true,
    },

    product: {
      type: [orderItemSchema],
      validate: [
        (val) => val.length > 0,
        "Order must contain at least one item",
      ],
    },

    // ── Pricing ──
    orderTotal: {
      type: Number,
      required: true,
    },

    shippingCharge: {
      type: Number,
      default: 0,
    },

    shippingMode: {
      type: String,
      enum: ["air", "road"],
      default: "road",
    },

    // ── Wallet fields ──
    walletDiscount: {
      type: Number,
      default: 0, // Rs covered by wallet (coins / balance / referral)
    },

    onlineAmount: {
      type: Number,
      default: 0, // remaining amount paid online (if any) 
    },

    walletOption: {
      type: String,
      enum: ["COINS", "BALANCE", "REFERRAL", null],
      default: null,
    },

    // ── Payment ──
    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD", "WALLET"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
    },
    couponCode:{
      type:String,
      default:null,
    },
    couponDiscount:{
      type:Number,
      default:0,
    },

    // ── Referral ──
    referralToken: {
      type: String,
      default: null,
    },

    referrerId: {
      type: ObjectId,
      ref: "user",
      default: null,
    },

    // ── Address ──
    address: {
      type: ObjectId,
      ref: "address",
      required: true,
    },

    // ── Misc ──
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },

    transactionId: {
      type: ObjectId,
      ref: "transaction",
    },

    paymentSessionId: {
      type: String,
    },

    deliveredDate: {
      type: Date,
    },

    affiliateCode: {
      type: String,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: null,
    },

    invoiceUrl: {
      type: String,
      default: null,
    },

    cancellationInvoiceUrl: {
      type: String,
      default: null,
    },

    returnReason: {
      type: String,
      default: null,
    },
    
    returnMedia: [
      {
        type: String,
      },
    ],
    
    returnAdminReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

orderSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model("order", orderSchema);
