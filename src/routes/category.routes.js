import express from "express";
import CategoryController from "../controllers/category.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

// CREATE
router.post(
  "/create/category",
  authUser,
  adminMiddleware,
  ObjectStorageService.s3Uploader().single("icon"),
  CategoryController.createCategory,
);

// UPDATE
router.put(
  "/category/:id",
  authUser,
  adminMiddleware,
  ObjectStorageService.s3Uploader().single("icon"), 
  CategoryController.updateCategory,
);

// DELETE
router.delete(
  "/category/:id",
  authUser,
  adminMiddleware,
  CategoryController.deleteCategory,
);

// TOGGLE STATUS
router.patch(
  "/category/:id/status",
  authUser,
  adminMiddleware,
  CategoryController.toggleCategoryStatus,
);

// GET ALL
router.get("/categories", authUser, CategoryController.getAllCategories);

// GET BY ID
router.get("/category/:id", authUser, CategoryController.getCategoryById);



export default router; 
