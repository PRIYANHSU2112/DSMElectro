import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
  {
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "affiliate",
      required: true,
    },
    affiliateCode: { type: String, required: true },

    // context of what was clicked
    itemType: {
      type: String,
      enum: ["product", "variant", "combo"],
      default: null,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // visitor info
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    country: { type: String, default: null },
  },
  { timestamps: true },
);

clickSchema.index({ affiliateId: 1, createdAt: -1 });
clickSchema.index({ affiliateCode: 1 });
clickSchema.index({ createdAt: -1 });

export default mongoose.model("affiliateClick", clickSchema);
