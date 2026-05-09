import mongoose from "mongoose"; // Sanvi

const stateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    countryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      index: true,
    },

    code: String,

    disable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

stateSchema.index({ countryId: 1, name: 1 }, { unique: true });

export default mongoose.model("State", stateSchema);
