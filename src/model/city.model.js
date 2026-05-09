import mongoose from "mongoose"; // Sanvi

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    stateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      index: true,
    },

    countryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      index: true,
    },

    disable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

citySchema.index({ stateId: 1, name: 1 }, { unique: true });

export default mongoose.model("City", citySchema);
