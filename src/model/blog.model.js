import mongoose from "mongoose";

const keyFeatureSchema = new mongoose.Schema({
  title: { type: String, trim: true, required: true },
  description: { type: String, trim: true },
});

const possibilitySchema = new mongoose.Schema({
  point: { type: String, trim: true, required: true },
});

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subCategory",
      required: true,
    },
    publishDate: { type: Date, default: Date.now },
    icon: { type: String, default: null },       // small icon image URL
    banner: { type: String, default: null },     // banner/hero image URL
    images: [{ type: String }],                  // multiple images array of URLs
    description: { type: String, trim: true },
    keyFeatures: [keyFeatureSchema],             // [{ title, description }]
    possibilities: {
      title: { type: String, trim: true },
      points: [possibilitySchema],               // [{ point }]
    },
    details: { type: String, trim: true },
    conclusion: {
      title: { type: String, trim: true },
      content: { type: String, trim: true },
    },
    disable: { type: Boolean, default: false },
  },
  { timestamps: true }
);

blogSchema.index({ title: 1 });
blogSchema.index({ category: 1, subCategory: 1 });

const blogModel = mongoose.model("Blog", blogSchema);
export default blogModel;