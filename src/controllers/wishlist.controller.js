import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import WishlistService from "../services/wishlistServices.js";
import {
  addWishlistSchema,
  removeWishlistSchema,
} from "../validators/wishlistValidation.js";

export default class WishlistController {
  // ADD
  static async addToWishlist(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = addWishlistSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const userId = req.user._id;

      const item = await WishlistService.addToWishlist(userId, req.body);

      return [{ data: item }, "Added to wishlist", 200];
    });
  }

  // REMOVE
  static async removeFromWishlist(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = removeWishlistSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const userId = req.user._id;

      await WishlistService.removeFromWishlist(userId, req.body);

      return [{}, "Removed from wishlist", 200];
    });
  }

  // GET
  static async getWishlist(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;

      const data = await WishlistService.getWishlist(userId);

      return [{ data }, "Wishlist fetched successfully", 200];
    });
  }

  // GET BY USER ID (ADMIN)
  static async getWishlistByUser(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.params.userId;

      const data = await WishlistService.getWishlistByUser(userId);

      return [{ data }, "User wishlist fetched successfully", 200];
    });
  }

  // TOGGLE DISABLE
  static async toggleWishlistStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;

      const item = await WishlistService.toggleWishlistStatus(userId, req.body);

      return [
        { data: item },
        item.disable ? "Wishlist item disabled" : "Wishlist item enabled",
        200,
      ];
    });
  }
}
