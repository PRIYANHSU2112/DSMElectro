// services/subCategoryServices.js

import subCategoryModel from "../model/subCategory.model.js";
import categoryModel from "../model/category.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class SubCategoryService {
  // CREATE
  static async createSubCategory(payload) {
    const { category, title } = payload;

    const categoryExists = await categoryModel.findById(category);
    if (!categoryExists) {
      throw new AppError("Category not found", 404);
    }

    const exists = await subCategoryModel.findOne({ title, category });
    if (exists) {
      throw new AppError("SubCategory already exists in this category", 400);
    }

    return await subCategoryModel.create(payload);XMLDocumen
  }

  // UPDATE
  static async updateSubCategory(id, payload) {
    const subCategory = await subCategoryModel.findById(id);
    if (!subCategory) {
      throw new AppError("SubCategory not found", 404);
    }

    if (payload.category) {
      const categoryExists = await categoryModel.findById(payload.category);
      if (!categoryExists) {
        throw new AppError("Category not found", 404);
      }
    }

    Object.assign(subCategory, payload);
    await subCategory.save();

    return subCategory;
  }

  // DELETE
  static async deleteSubCategory(id) {
    const subCategory = await subCategoryModel.findById(id);
    if (!subCategory) {
      throw new AppError("SubCategory not found", 404);
    }

    await subCategory.deleteOne();
    return true;
  }

  // GET BY ID
  static async getSubCategoryById(id) {
    const subCategory = await subCategoryModel
      .findById(id)
      .populate("category");

    if (!subCategory) {
      throw new AppError("SubCategory not found", 404);
    }

    return subCategory;
  }

  // GET ALL (PAGINATION)
  static async getAllSubCategories(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.category) {
      filter.category = query.category;
    }

    if (query.disable !== undefined) {
      filter.disable = query.disable === "true";
    }

    const [subCategories, total] = await Promise.all([
      subCategoryModel
        .find(filter)
        .populate("category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      subCategoryModel.countDocuments(filter),
    ]);

    return {
      subCategories,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // TOGGLE STATUS
  static async toggleSubCategoryStatus(id) {
    const updated = await subCategoryModel.findByIdAndUpdate(
      id,
      [{ $set: { disable: { $not: "$disable" } } }],
      { new: true }
    );

    if (!updated) {
      throw new AppError("SubCategory not found", 404);
    }

    return updated;
  }

  // GET BY CATEGORY
  static async getSubCategoryByCategory(categoryId, query) {
    return this.getAllSubCategories({ ...query, category: categoryId });
  }
}