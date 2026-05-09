import mongoose from "mongoose"; //sanvi

const countrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      uppercase: true,
      index: true,
    },
    disable: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Country", countrySchema);
