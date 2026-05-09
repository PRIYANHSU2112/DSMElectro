import express from "express";
import BlogController from "../controllers/blog.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

// Multer config: icon (1), banner (1), images (many)
const blogUpload = ObjectStorageService.s3Uploader().fields([
    { name: "icon", maxCount: 1 },
    { name: "banner", maxCount: 1 },
    { name: "images", maxCount: 10 },
]);

// CREATE
router.post("/create/blog", authUser, adminMiddleware, blogUpload, BlogController.createBlog);
 
// UPDATE
router.put("/blog/:id", authUser, adminMiddleware, blogUpload, BlogController.updateBlog);

// DELETE
router.delete("/blog/:id", authUser, adminMiddleware, BlogController.deleteBlog);

// TOGGLE STATUS
router.patch("/blog/:id/status", authUser, adminMiddleware, BlogController.toggleBlogStatus);

// GET ALL  (supports ?category=&subCategory=&disable=&search=&page=&limit=)
router.get("/blogs", authUser, BlogController.getAllBlogs);

// GET BY ID
router.get("/blog/:id", authUser, BlogController.getBlogById);

// GET BY CATEGORY
router.get("/blogs/category/:categoryId", authUser, BlogController.getBlogsByCategory);

// GET BY SUBCATEGORY
router.get("/blogs/subcategory/:subCategoryId", authUser, BlogController.getBlogsBySubCategory);

export default router;