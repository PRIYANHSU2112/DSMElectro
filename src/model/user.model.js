import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
    },

    number: {
      type: String,
      trim: true,
    },

    fcmToken: {
      type: String,
      trim: true,
    },

    address: {
      type: mongoose.Schema.ObjectId,
      ref: "address",
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },

    otp: {
      code: String,
      expiresAt: Date,
    },
    disable: {
      type: Boolean,
      default: false,
    },

    fcmToken: {
      type: String,
    },
    permissions: [
      {
        type: String,
      },
    ],

    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    referralCode: {
      type: String,
      sparse: true,
    },
  },
  { timestamps: true },
);

const userModel = mongoose.model("user", userSchema);

export default userModel;
