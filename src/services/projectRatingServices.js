import projectRatingModel from "../model/projectRating.model.js";
import projectModel from "../model/project.model.js";
import { AppError } from "../utils/apiResponse.js";
import "../model/user.model.js";

export default class ProjectRatingService {
  // ADD OR UPDATE RATING
  static async upsertRating(projectId, userId, payload) {
    const project = await projectModel.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    const existing = await projectRatingModel.findOne({
      project: projectId,
      user: userId,
    });

    let ratingDoc;

    if (existing) {
      // Update existing rating
      const oldRating = existing.rating;
      existing.rating = payload.rating;
      if (payload.review !== undefined) existing.review = payload.review;
      await existing.save();
      ratingDoc = existing;

      // Recompute project avg: remove old, add new
      const totalScore =
        project.rating * project.totalRatings - oldRating + payload.rating;
      project.rating = parseFloat((totalScore / project.totalRatings).toFixed(2));
    } else {
      // New rating
      ratingDoc = await projectRatingModel.create({
        project: projectId,
        user: userId,
        rating: payload.rating,
        review: payload.review || null,
      });

      const totalScore = project.rating * project.totalRatings + payload.rating;
      project.totalRatings += 1;
      project.rating = parseFloat((totalScore / project.totalRatings).toFixed(2));
    }

    await project.save();

    return {
      rating: ratingDoc,
      projectRating: project.rating,
      totalRatings: project.totalRatings,
    };
  }

  // DELETE RATING
  static async deleteRating(projectId, userId) {
    const ratingDoc = await projectRatingModel.findOne({
      project: projectId,
      user: userId,
    });

    if (!ratingDoc) throw new AppError("Rating not found", 404);

    const project = await projectModel.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    await ratingDoc.deleteOne();

    if (project.totalRatings <= 1) {
      project.rating = 0;
      project.totalRatings = 0;
    } else {
      const totalScore =
        project.rating * project.totalRatings - ratingDoc.rating;
      project.totalRatings -= 1;
      project.rating = parseFloat((totalScore / project.totalRatings).toFixed(2));
    }

    await project.save();

    return {
      projectRating: project.rating,
      totalRatings: project.totalRatings,
    };
  }

  // GET MY RATING FOR A PROJECT
  static async getMyRating(projectId, userId) {
    const rating = await projectRatingModel.findOne({
      project: projectId,
      user: userId,
    });

    if (!rating) throw new AppError("You have not rated this project", 404);
    return rating;
  }

  // GET ALL RATINGS FOR A PROJECT (PAGINATED)
  static async getProjectRatings(projectId, query) {
    const project = await projectModel.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { project: projectId };
    if (query.rating) filter.rating = parseInt(query.rating); // filter by star

    const [ratings, total] = await Promise.all([
      projectRatingModel
        .find(filter)
        .populate("user", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      projectRatingModel.countDocuments(filter),
    ]);

    // Star breakdown  { 1: 0, 2: 3, 3: 10, 4: 20, 5: 40 }
    const breakdown = await projectRatingModel.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);

    const starBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdown.forEach(({ _id, count }) => {
      starBreakdown[_id] = count;
    });

    return {
      ratings,
      starBreakdown,
      summary: {
        averageRating: project.rating,
        totalRatings: project.totalRatings,
      },
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ADMIN — GET ALL RATINGS ACROSS ALL PROJECTS
  static async getAllRatings(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.project) filter.project = query.project;
    if (query.rating) filter.rating = parseInt(query.rating);

    const [ratings, total] = await Promise.all([
      projectRatingModel
        .find(filter)
        .populate("user", "name email avatar")
        .populate("project", "title icon rating totalRatings")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      projectRatingModel.countDocuments(filter),
    ]);

    return {
      ratings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ADMIN — DELETE ANY RATING BY ID
  static async adminDeleteRating(ratingId) {
    const ratingDoc = await projectRatingModel.findById(ratingId);
    if (!ratingDoc) throw new AppError("Rating not found", 404);

    const project = await projectModel.findById(ratingDoc.project);

    await ratingDoc.deleteOne();

    if (project) {
      if (project.totalRatings <= 1) {
        project.rating = 0;
        project.totalRatings = 0;
      } else {
        const totalScore =
          project.rating * project.totalRatings - ratingDoc.rating;
        project.totalRatings -= 1;
        project.rating = parseFloat(
          (totalScore / project.totalRatings).toFixed(2)
        );
      }
      await project.save();
    }

    return true;
  }
}