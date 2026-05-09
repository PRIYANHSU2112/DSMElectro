import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "variant",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    disable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

wishlistSchema.index({ user: 1 });
wishlistSchema.index({ product: 1 });
wishlistSchema.index({ variant: 1 });

const wishlistModel = mongoose.model("wishlist", wishlistSchema);

export default wishlistModel;
