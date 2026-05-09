// routes/subCategory.routes.js

import express from "express";
import SubCategoryController from "../controllers/subCategory.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

router.post(
  "/sub-category",
  authUser,
  ObjectStorageService.s3Uploader().fields([
    { name: "icon", maxCount: 1 },
  ]),
  SubCategoryController.create
);

router.put(
  "/sub-category/:id",
  authUser,
  ObjectStorageService.s3Uploader().fields([
    { name: "icon", maxCount: 1 },
  ]),
  SubCategoryController.update
);

router.delete("/sub-category/:id", authUser, SubCategoryController.delete);

router.get("/sub-category/:id", SubCategoryController.getById);

router.get("/sub-category", SubCategoryController.getAll);

router.patch(
  "/sub-category/toggle/:id",
  authUser,
  SubCategoryController.toggleStatus
);

router.get(
  "/sub-category/category/:categoryId",
  SubCategoryController.getByCategory
);

export default router;