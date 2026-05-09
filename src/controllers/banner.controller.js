import {
  handleApiRequest,
  ValidationError,
} from "../utils/apiResponse.js";
import BannerService from "../services/banner.service.js";
import {
  createBannerSchema,
  updateBannerSchema,
  reorderBannersSchema,
} from "../validators/bannerValidation.js";

export default class BannerController {
  static async createBanner(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = createBannerSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      if (!req.files || !req.files.image || req.files.image.length === 0) {
        throw new ValidationError("Banner image is required");
      }

      const payload = {
        ...req.body,
        image: req.files.image[0].location,
      };

      const result = await BannerService.createBanner(payload);
      return [{ data: result }, "Banner created successfully", 201];
    });
  }

  static async getAllBanners(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await BannerService.getAllBanners(req.query);
      return [{ data: result }, "Banners fetched successfully"];
    });
  }

  static async getActiveBanners(req, res) {
    return handleApiRequest(req, res, async () => {
      const { targetPage } = req.query;
      const result = await BannerService.getActiveBanners(targetPage);
      return [{ data: result }, "Active banners fetched successfully"];
    });
  }

  static async updateBanner(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = updateBannerSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const payload = { ...req.body };
      if (req.files && req.files.image && req.files.image.length > 0) {
        payload.image = req.files.image[0].location;
      }

      const result = await BannerService.updateBanner(req.params.id, payload);
      return [{ data: result }, "Banner updated successfully"];
    });
  }

  static async deleteBanner(req, res) {
    return handleApiRequest(req, res, async () => {
      await BannerService.deleteBanner(req.params.id);
      return [{}, "Banner deleted successfully"];
    });
  }

  static async reorderBanners(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = reorderBannersSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      await BannerService.reorderBanners(req.body.page, req.body.banners);
      return [{}, "Banners reordered successfully"];
    });
  }
}
