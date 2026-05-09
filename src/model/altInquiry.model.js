// models/atlInquiry.model.js
import mongoose from "mongoose";

const atlInquirySchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    phone: String,
    schoolName: String,
    city: String,
    areaSqFt: Number,
    budgetRange: String,
    message: String,
  },
  { timestamps: true },
);

export default mongoose.model("AtlInquiry", atlInquirySchema);
