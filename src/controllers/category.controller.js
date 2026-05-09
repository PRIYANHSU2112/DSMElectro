import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import CategoryService from "../services/categoryServices.js";
import {
  categorySchema,
  updateCategorySchema,
} from "../validators/categoryValidation.js";

export default class CategoryController {
  // CREATE
  static async createCategory(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = categorySchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const payload = {
        ...req.body,
        icon: req.file?.location || null,
      };

      const category = await CategoryService.createCategory(payload);

      return [{ data: category }, "Category created successfully", 201];
    });
  }
  // UPDATE
  static async updateCategory(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = updateCategorySchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const categoryId = req.params.id;

      const payload = { ...req.body };

      if (req.file) {
        payload.icon = req.file.location;
      }

      const updated = await CategoryService.updateCategory(categoryId, payload);

      return [{ data: updated }, "Category updated successfully", 200];
    });
  }

  // DELETE
  static async deleteCategory(req, res) {
    return handleApiRequest(req, res, async () => {
      const categoryId = req.params.id;

      await CategoryService.deleteCategory(categoryId);

      return [{}, "Category deleted successfully", 200];
    });
  }

  // GET BY ID
  static async getCategoryById(req, res) {
    return handleApiRequest(req, res, async () => {
      const categoryId = req.params.id;

      const category = await CategoryService.getCategoryById(categoryId);

      return [{ data: category }, "Category fetched successfully", 200];
    });
  }

  // GET ALL
  static async getAllCategories(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await CategoryService.getAllCategories(req.query);

      return [
        {
          data: result.categories,
          pagination: result.pagination,
        },
        "Categories fetched successfully",
        200,
      ];
    });
  }

  // TOGGLE DISABLE
 static async toggleCategoryStatus(req, res) {
  return handleApiRequest(req, res, async () => {
    const categoryId = req.params.id;

    const category = await CategoryService.toggleCategoryStatus(categoryId);

    return [
      { data: category },
      category.disable
        ? "Category disabled successfully"
        : "Category enabled successfully",
      200,
    ];
  });
}
}
