import mongoose from "mongoose";

const commissionSchema = new mongoose.Schema(
  {
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "affiliate",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    // what was purchased
    itemType: {
      type: String,
      enum: ["product", "variant", "combo"],
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    itemName: {
      type: String,
      default: null,
    },

    orderAmount:       { type: Number, required: true },
    commissionPercent: { type: Number, required: true },
    commissionAmount:  { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "credited", "reversed"],
      default: "credited",
    },
  },
  { timestamps: true },
);

commissionSchema.index({ affiliateId: 1, createdAt: -1 });
commissionSchema.index({ affiliateId: 1, status: 1 });
// Compound: supports monthly sales COUNT in recordCommission tier logic
commissionSchema.index({ affiliateId: 1, status: 1, createdAt: 1 });
// Compound: supports admin overview period queries
commissionSchema.index({ status: 1, createdAt: 1 });
commissionSchema.index({ orderId: 1 });
commissionSchema.index({ buyerId: 1 });

export default mongoose.model("affiliateCommission", commissionSchema);