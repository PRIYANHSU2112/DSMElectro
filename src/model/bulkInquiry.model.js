import mongoose from "mongoose";

const bulkInquirySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
        required: true,
      },
    ],

    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "country",
      required: true,
    },

    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "state",
      required: true,
    },

    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "city",
      required: true,
    },

    pincode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "pincode",
      required: true,
    },

    message: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "contacted", "closed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

bulkInquirySchema.index({ userId: 1 });
bulkInquirySchema.index({ products: 1 });
bulkInquirySchema.index({ createdAt: -1 });

const bulkInquiryModel = mongoose.model("bulkInquiry", bulkInquirySchema);

export default bulkInquiryModel;