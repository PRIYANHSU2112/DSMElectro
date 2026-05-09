import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    rating: {
      type: Number,
      min: 0,
      max: 5,
      required: true,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// one user → one rating per product
ratingSchema.index({ productId: 1, userId: 1 }, { unique: true });

export default mongoose.model("rating", ratingSchema);