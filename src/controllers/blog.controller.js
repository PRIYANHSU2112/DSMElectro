import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import BlogService from "../services/blogServices.js";
import { blogSchema, updateBlogSchema } from "../validators/blodValidations.js";

export default class BlogController {
    // CREATE
    static async createBlog(req, res) {
        return handleApiRequest(req, res, async () => {
            // Parse JSON fields sent as strings (common with multipart/form-data)
            const body = { ...req.body };
            ["keyFeatures", "possibilities", "conclusion"].forEach((key) => {
                if (typeof body[key] === "string") {
                    try { body[key] = JSON.parse(body[key]); } catch (_) { }
                }
            });

            const { error } = blogSchema.validate(body);
            if (error) throw new ValidationError(error.details[0].message);

            const files = req.files || {};
            const payload = {
                ...body,
                icon: files.icon?.[0]?.location || null,
                banner: files.banner?.[0]?.location || null,
                images: files.images?.map((f) => f.location) || [],
            };

            const data = await BlogService.createBlog(payload);
            return [{ data }, "Blog created successfully", 201];
        });
    }

    // UPDATE
    static async updateBlog(req, res) {
        return handleApiRequest(req, res, async () => {
            const body = { ...req.body };
            ["keyFeatures", "possibilities", "conclusion"].forEach((key) => {
                if (typeof body[key] === "string") {
                    try { body[key] = JSON.parse(body[key]); } catch (_) { }
                }
            });

            const { error } = updateBlogSchema.validate(body);
            if (error) throw new ValidationError(error.details[0].message);

            const files = req.files || {};
            const payload = { ...body };
            if (files.icon?.[0]) payload.icon = files.icon[0].location;
            if (files.banner?.[0]) payload.banner = files.banner[0].location;
            if (files.images?.length) payload.images = files.images.map((f) => f.location);

            const data = await BlogService.updateBlog(req.params.id, payload);
            return [{ data }, "Blog updated successfully"];
        });
    }

    // DELETE
    static async deleteBlog(req, res) {
        return handleApiRequest(req, res, async () => {
            await BlogService.deleteBlog(req.params.id);
            return [{}, "Blog deleted successfully"];
        });
    }

    // GET BY ID
    static async getBlogById(req, res) {
        return handleApiRequest(req, res, async () => {
            const data = await BlogService.getBlogById(req.params.id);
            return [{ data }, "Blog fetched successfully"];
        });
    }

    // GET ALL
    static async getAllBlogs(req, res) {
        return handleApiRequest(req, res, async () => {
            const result = await BlogService.getAllBlogs(req.query);
            return [{ data: result.blogs, pagination: result.pagination }, "Blogs fetched successfully"];
        });
    }

    // TOGGLE STATUS
    static async toggleBlogStatus(req, res) {
        return handleApiRequest(req, res, async () => {
            const data = await BlogService.toggleBlogStatus(req.params.id);
            return [
                { data },
                data.disable ? "Blog disabled successfully" : "Blog enabled successfully",
            ];
        });
    }

    // GET BY CATEGORY
    static async getBlogsByCategory(req, res) {
        return handleApiRequest(req, res, async () => {
            const result = await BlogService.getBlogsByCategory(req.params.categoryId, req.query);
            return [{ data: result.blogs, pagination: result.pagination }, "Blogs fetched successfully"];
        });
    }

    // GET BY SUBCATEGORY
    static async getBlogsBySubCategory(req, res) {
        return handleApiRequest(req, res, async () => {
            const result = await BlogService.getBlogsBySubCategory(req.params.subCategoryId, req.query);
            return [{ data: result.blogs, pagination: result.pagination }, "Blogs fetched successfully"];
        });
    }
}