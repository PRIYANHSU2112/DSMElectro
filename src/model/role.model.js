import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    permissions: [
      {
        type: String,
      },
    ],
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const roleModel = mongoose.model("Role", roleSchema);

export default roleModel;
