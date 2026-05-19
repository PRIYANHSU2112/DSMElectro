import mongoose from "mongoose";

const affiliateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },

    // ── Personal Info ────────────────────────────────────────────────────────
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ["male", "female", "other"], default: null },

    // ── Business (optional) ──────────────────────────────────────────────────
    gstNumber: { type: String, default: null, trim: true },
    companyName: { type: String, default: null, trim: true },

    // ── KYC ─────────────────────────────────────────────────────────────────
    panNumber: { type: String, required: true, trim: true, uppercase: true },
    panImage: { type: String, required: true }, // S3 URL
    adharNumber: { type: String, required: true, trim: true },
    adharImage: { type: String, required: true }, // S3 URL

    // ── Bank Details ─────────────────────────────────────────────────────────
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, trim: true, uppercase: true },
    accountHolder: { type: String, required: true, trim: true },

    // ── UPI ──────────────────────────────────────────────────────────────────
    upiId: { type: String, default: null, trim: true },

    // ── DSM Wallet ───────────────────────────────────────────────────────────
    dsmUserId: { type: String, default: null, trim: true },

    // ── Admin Control ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, default: null },
    affiliateCode: { type: String, unique: true, sparse: true },

    // null = use global commission from Redis
    commissionPercent: { type: Number, default: null, min: 0, max: 100 },

    // ── Wallet ───────────────────────────────────────────────────────────────
    walletBalance: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

affiliateSchema.index({ status: 1 });
affiliateSchema.index({ phone: 1 });

export default mongoose.model("affiliate", affiliateSchema);
