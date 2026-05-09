import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import RatingService from "../services/ratingServices.js";
import { ratingSchema } from "../validators/ratingValidation.js";

export default class RatingController {
  static async addRating(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = ratingSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const userId = req.user._id;

      const result = await RatingService.addRating(userId, req.body);

      return [{ data: result }, "Rating added successfully", 201];
    });
  }

  static async getRatings(req, res) {
    return handleApiRequest(req, res, async () => {
      const { productId } = req.params;

      const result = await RatingService.getRatings(productId, req.query);

      return [{ data: result }, "Ratings fetched", 200];
    });
  }
}
