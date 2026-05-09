import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import ProjectRatingService from "../services/projectRatingServices.js";

export default class ProjectRatingController {
  // ADD OR UPDATE MY RATING
  static async upsertRating(req, res) {
    return handleApiRequest(req, res, async () => {
      const { rating, review } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        throw new ValidationError("Rating must be between 1 and 5");
      }

      const data = await ProjectRatingService.upsertRating(
        req.params.projectId,
        req.user._id,
        { rating: Number(rating), review }
      );

      return [{ data }, "Rating submitted successfully", 200];
    });
  }

  // DELETE MY RATING
  static async deleteMyRating(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await ProjectRatingService.deleteRating(
        req.params.projectId,
        req.user._id
      );
      return [{ data }, "Rating removed successfully"];
    });
  }

  // GET MY RATING
  static async getMyRating(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await ProjectRatingService.getMyRating(
        req.params.projectId,
        req.user._id
      );
      return [{ data }, "Your rating fetched successfully"];
    });
  }

  // GET ALL RATINGS FOR A PROJECT
  static async getProjectRatings(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await ProjectRatingService.getProjectRatings(
        req.params.projectId,
        req.query
      );
      return [
        {
          data: data.ratings,
          starBreakdown: data.starBreakdown,
          summary: data.summary,
          pagination: data.pagination,
        },
        "Ratings fetched successfully",
      ];
    });
  }

  // ADMIN — GET ALL RATINGS
  static async getAllRatings(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProjectRatingService.getAllRatings(req.query);
      return [
        { data: result.ratings, pagination: result.pagination },
        "All ratings fetched successfully",
      ];
    });
  }

  // ADMIN — DELETE ANY RATING
  static async adminDeleteRating(req, res) {
    return handleApiRequest(req, res, async () => {
      await ProjectRatingService.adminDeleteRating(req.params.ratingId);
      return [{}, "Rating deleted successfully"];
    });
  }
}