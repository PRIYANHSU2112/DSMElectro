import projectModel from "../model/project.model.js";
import categoryModel from "../model/category.model.js";
import subCategoryModel from "../model/subCategory.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class ProjectService {
    // CREATE
    static async createProject(payload) {
        const { category, subCategory } = payload;

        const categoryExists = await categoryModel.findById(category);
        if (!categoryExists) throw new AppError("Category not found", 404);

        const subCategoryExists = await subCategoryModel.findOne({
            _id: subCategory,
            category,
        });
        if (!subCategoryExists)
            throw new AppError("SubCategory not found under this Category", 404);

        return await projectModel.create(payload);
    }

    // UPDATE
    static async updateProject(id, payload) {
        const project = await projectModel.findById(id);
        if (!project) throw new AppError("Project not found", 404);

        if (payload.category) {
            const exists = await categoryModel.findById(payload.category);
            if (!exists) throw new AppError("Category not found", 404);
        }

        if (payload.subCategory) {
            const categoryId = payload.category || project.category;
            const exists = await subCategoryModel.findOne({
                _id: payload.subCategory,
                category: categoryId,
            });
            if (!exists)
                throw new AppError("SubCategory not found under this Category", 404);
        }

        if (payload.images && payload.appendImages) {
            payload.images = [...(project.images || []), ...payload.images];
        }
        delete payload.appendImages;

        Object.assign(project, payload);
        await project.save();
        return project;
    }

    // DELETE
    static async deleteProject(id) {
        const project = await projectModel.findById(id);
        if (!project) throw new AppError("Project not found", 404);
        await project.deleteOne();
        return true;
    }

    // GET BY ID (auto-increments views)
    static async getProjectById(id) {
        const project = await projectModel
            .findById(id)
            .populate("category", "title icon")
            .populate("subCategory", "title icon");

        if (!project) throw new AppError("Project not found", 404);

        await projectModel.findByIdAndUpdate(id, { $inc: { totalViews: 1 } });

        return project;
    }

    // GET ALL
    static async getAllProjects(query) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};

        // Existing filters
        if (query.category) filter.category = query.category;
        if (query.subCategory) filter.subCategory = query.subCategory;
        if (query.disable !== undefined) filter.disable = query.disable === "true";
        if (query.search) filter.title = { $regex: query.search, $options: "i" };

        // Price range filter
        if (query.minPrice || query.maxPrice) {
            filter.finalPrice = {};
            if (query.minPrice) filter.finalPrice.$gte = parseFloat(query.minPrice);
            if (query.maxPrice) filter.finalPrice.$lte = parseFloat(query.maxPrice);
        }

        // ✅ Rating filter (e.g. rating=3 → projects with rating >= 3 and < 4)
        if (query.rating) {
            const ratingValue = parseFloat(query.rating);
            if (ratingValue >= 1 && ratingValue <= 5) {
                filter.rating = {
                    $gte: ratingValue,
                    $lt: ratingValue + 1,
                };
            }
        }

        // ✅ Project type filter (beginner | intermediate | advance)
        if (query.projectType) {
            const validTypes = ["beginner", "intermediate", "advance"];
            if (validTypes.includes(query.projectType)) {
                filter.projectType = query.projectType;
            }
        }

        // ✅ Sort options (default: newest)
        const sortMap = {
            newest: { createdAt: -1 },
            low: { finalPrice: 1 },
            high: { finalPrice: -1 },
            rating: { rating: -1 },
            popular: { totalViews: -1 },
            downloads: { totalDownloads: -1 },
        };
        const sort = sortMap[query.sort] || { createdAt: -1 }; // default → newest

        const [projects, total] = await Promise.all([
            projectModel
                .find(filter)
                .populate("category", "title icon")
                .populate("subCategory", "title icon")
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            projectModel.countDocuments(filter),
        ]);

        return {
            projects,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // INCREMENT DOWNLOADS
    static async incrementDownloads(id) {
        const project = await projectModel.findByIdAndUpdate(
            id,
            { $inc: { totalDownloads: 1 } },
            { new: true }
        );
        if (!project) throw new AppError("Project not found", 404);
        return project;
    }

    // TOGGLE STATUS
    static async toggleProjectStatus(id) {
        const project = await projectModel.findById(id);

        if (!project) throw new AppError("Project not found", 404);

        project.disable = !project.disable;
        await project.save();

        return project;
    }

    // GET BY CATEGORY
    static async getProjectsByCategory(categoryId, query) {
        return this.getAllProjects({ ...query, category: categoryId });
    }

    // GET BY SUBCATEGORY
    static async getProjectsBySubCategory(subCategoryId, query) {
        return this.getAllProjects({ ...query, subCategory: subCategoryId });
    }
}