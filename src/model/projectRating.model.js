import mongoose from "mongoose";

const projectRatingSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// One rating per user per project
projectRatingSchema.index({ project: 1, user: 1 }, { unique: true });

const projectRatingModel = mongoose.model("ProjectRating", projectRatingSchema);
export default projectRatingModel;