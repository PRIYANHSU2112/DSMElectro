import blogModel from "../model/blog.model.js";
import categoryModel from "../model/category.model.js";
import subCategoryModel from "../model/subCategory.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class BlogService {
  // CREATE
  static async createBlog(payload) {
    const { category, subCategory } = payload;

    const categoryExists = await categoryModel.findById(category);
    if (!categoryExists) throw new AppError("Category not found", 404);

    const subCategoryExists = await subCategoryModel.findOne({
      _id: subCategory,
      category,
    });
    if (!subCategoryExists)
      throw new AppError("SubCategory not found under this Category", 404);

    return await blogModel.create(payload);
  }

  // UPDATE
  static async updateBlog(id, payload) {
    const blog = await blogModel.findById(id);
    if (!blog) throw new AppError("Blog not found", 404);

    if (payload.category) {
      const exists = await categoryModel.findById(payload.category);
      if (!exists) throw new AppError("Category not found", 404);
    }

    if (payload.subCategory) {
      const categoryId = payload.category || blog.category;
      const exists = await subCategoryModel.findOne({
        _id: payload.subCategory,
        category: categoryId,
      });
      if (!exists)
        throw new AppError("SubCategory not found under this Category", 404);
    }

    // Handle images array: merge or replace based on payload
    if (payload.images && payload.appendImages) {
      payload.images = [...(blog.images || []), ...payload.images];
    }
    delete payload.appendImages;

    Object.assign(blog, payload);
    await blog.save();
    return blog;
  }

  // DELETE
  static async deleteBlog(id) {
    const blog = await blogModel.findById(id);
    if (!blog) throw new AppError("Blog not found", 404);
    await blog.deleteOne();
    return true;
  }

  // GET BY ID
  static async getBlogById(id) {
    const blog = await blogModel
      .findById(id)
      .populate("category")
      .populate("subCategory");
    if (!blog) throw new AppError("Blog not found", 404);
    return blog;
  }

  // GET ALL (PAGINATION + FILTERS)
  static async getAllBlogs(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.category) filter.category = query.category;
    if (query.subCategory) filter.subCategory = query.subCategory;
    if (query.disable !== undefined) filter.disable = query.disable === "true";
    if (query.search) {
      filter.title = { $regex: query.search, $options: "i" };
    }

    const [blogs, total] = await Promise.all([
      blogModel
        .find(filter)
        .populate("category", "title icon")
        .populate("subCategory", "title icon")
        .sort({ publishDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      blogModel.countDocuments(filter),
    ]);

    return {
      blogs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // TOGGLE STATUS
  static async toggleBlogStatus(id) {
    const updated = await blogModel.findByIdAndUpdate(
      id,
      [{ $set: { disable: { $not: "$disable" } } }],
      { new: true }
    );
    if (!updated) throw new AppError("Blog not found", 404);
    return updated;
  }

  // GET BY CATEGORY
  static async getBlogsByCategory(categoryId, query) {
    return this.getAllBlogs({ ...query, category: categoryId });
  }

  // GET BY SUBCATEGORY
  static async getBlogsBySubCategory(subCategoryId, query) {
    return this.getAllBlogs({ ...query, subCategory: subCategoryId });
  }
}