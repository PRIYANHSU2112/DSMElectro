import brandModel from "../model/brand.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class BrandService {
  // CREATE BRAND
  static async createBrand(payload) {
    const brand = await brandModel.create(payload);
    return brand;
  }

  // UPDATE BRAND
  static async updateBrand(brandId, payload) {
    const brand = await brandModel.findById(brandId);

    if (!brand) {
      throw new AppError("Brand not found", 404);
    }

    Object.assign(brand, payload);
    await brand.save();

    return brand;
  }

  // DELETE BRAND
  static async deleteBrand(brandId) {
    const brand = await brandModel.findById(brandId);

    if (!brand) {
      throw new AppError("Brand not found", 404);
    }

    await brand.deleteOne();

    return true;
  }

  // GET BRAND BY ID
  static async getBrandById(brandId) {
    const brand = await brandModel.findById(brandId)
      .populate("category", "title")
      .populate("subCategory", "title");

    if (!brand) {
      throw new AppError("Brand not found", 404);
    }
    return brand;
  }

  // GET ALL WITH PAGINATION AND OPTIMIZED SEARCH
  static async getAllBrands(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const { category, subCategory, search } = query;

    const skip = (page - 1) * limit;
    
    const filter = {};
    if (category) filter.category = category;
    if (subCategory) filter.subCategory = subCategory;
    
    if (search) {
      // Optimized search with case-insensitive regex and trimmed input
      const searchRegex = new RegExp(search.trim(), "i");
      filter.brandName = { $regex: searchRegex };
    }

    const brands = await brandModel
      .find(filter)
      .populate("category", "title")
      .populate("subCategory", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await brandModel.countDocuments(filter);

    return {
      brands,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET BRANDS BY CATEGORY ID
  static async getBrandsByCategory(categoryId, query) {
    return this.getAllBrands({ ...query, category: categoryId });
  }

  // GET BRANDS BY SUB-CATEGORY ID
  static async getBrandsBySubCategory(subCategoryId, query) {
    return this.getAllBrands({ ...query, subCategory: subCategoryId });
  }

  // TOGGLE DISABLE
  static async toggleBrandStatus(brandId) {
    const updated = await brandModel.findByIdAndUpdate(
      brandId,
      [
        {
          $set: {
            disable: { $not: "$disable" },
          },
        },
      ],
      {
        new: true,
        updatePipeline: true,
      },
    );

    if (!updated) {
      throw new AppError("Brand not found", 404);
    }

    return updated;
  }
}
