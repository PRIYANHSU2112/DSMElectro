import mongoose from "mongoose";

const scheduledEmailSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    email_type: {
      type: String,
      required: true,
      enum: ["renewal_reminder", "welcome", "expired"],
      lowercase: true,
    },
    send_at: {
      type: Date,
      required: true,
    },
    is_sent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index to easily find unsent pending emails
scheduledEmailSchema.index({ user_id: 1, is_sent: 1, send_at: 1 });

const ScheduledEmail = mongoose.model("ScheduledEmail", scheduledEmailSchema);

export default ScheduledEmail;
