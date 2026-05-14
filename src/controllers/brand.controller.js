import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import BrandService from "../services/brandServices.js";
import {
  brandSchema,
  updateBrandSchema,
} from "../validators/brandValidation.js";

export default class BrandController {
  // CREATE
  static async createBrand(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = brandSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const payload = {
        ...req.body,
        icon: req.file?.location || null,
      };

      const brand = await BrandService.createBrand(payload);

      return [{ data: brand }, "Brand created successfully", 201];
    });
  }

  // UPDATE
  static async updateBrand(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = updateBrandSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const brandId = req.params.id;
      const payload = { ...req.body };

      if (req.file) {
        payload.icon = req.file.location;
      }

      const updated = await BrandService.updateBrand(brandId, payload);

      return [{ data: updated }, "Brand updated successfully", 200];
    });
  }

  // DELETE
  static async deleteBrand(req, res) {
    return handleApiRequest(req, res, async () => {
      const brandId = req.params.id;

      await BrandService.deleteBrand(brandId);

      return [{}, "Brand deleted successfully", 200];
    });
  }

  // GET BY ID
  static async getBrandById(req, res) {
    return handleApiRequest(req, res, async () => {
      const brandId = req.params.id;

      const brand = await BrandService.getBrandById(brandId);

      return [{ data: brand }, "Brand fetched successfully", 200];
    });
  }

  // GET ALL
  static async getAllBrands(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await BrandService.getAllBrands(req.query);

      return [
        {
          data: result.brands,
          pagination: result.pagination,
        },
        "Brands fetched successfully",
        200,
      ];
    });
  }

  // GET BY CATEGORY
  static async getBrandsByCategory(req, res) {
    return handleApiRequest(req, res, async () => {
      const categoryId = req.params.categoryId;
      const result = await BrandService.getBrandsByCategory(categoryId, req.query);

      return [
        {
          data: result.brands,
          pagination: result.pagination,
        },
        "Brands fetched by category successfully",
        200,
      ];
    });
  }

  // GET BY SUB-CATEGORY
  static async getBrandsBySubCategory(req, res) {
    return handleApiRequest(req, res, async () => {
      const subCategoryId = req.params.subCategoryId;
      const result = await BrandService.getBrandsBySubCategory(subCategoryId, req.query);

      return [
        {
          data: result.brands,
          pagination: result.pagination,
        },
        "Brands fetched by sub-category successfully",
        200,
      ];
    });
  }

  // TOGGLE DISABLE
  static async toggleBrandStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const brandId = req.params.id;

      const brand = await BrandService.toggleBrandStatus(brandId);

      return [
        { data: brand },
        brand.disable
          ? "Brand disabled successfully"
          : "Brand enabled successfully",
        200,
      ];
    });
  }
}
