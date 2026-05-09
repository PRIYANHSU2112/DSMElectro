import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    jobType: {
      type: String,
      enum: ["full-time", "part-time", "internship"],
      required: true,
    },
    workMode: {
      type: String,
      enum: ["onsite", "remote", "hybrid"],
      required: true,
    },
    experience: {
      type: String,
      required: true, // e.g., "2-3 years"
    },
    
    // ─── LOCATION FIELDS ──────────────────────────────────────────
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      required: true,
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: true,
    },
    address: {
      type: String, // e.g., "Indrapuri, Bhopal"
      trim: true,
    },
    
    roleOverview: {
      type: String,
      required: true,
    },
    responsibilities: [
      {
        type: String,
      },
    ],
    qualifications: [
      {
        type: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);
