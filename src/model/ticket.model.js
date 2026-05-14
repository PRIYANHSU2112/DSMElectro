import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  time: {
    type: Date,
    default: Date.now
  }
});

const ticketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "general",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    messages: [messageSchema],
  },
  { timestamps: true }
);

const ticketModel = mongoose.model("ticket", ticketSchema);

export default ticketModel;
