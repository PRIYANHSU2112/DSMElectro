// routes/projectHero.routes.js

import express from "express";
import ProjectHeroController from "../controllers/projectHero.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

const upload = ObjectStorageService.s3Uploader().fields([
  { name: "pageIcon", maxCount: 1 },
  { name: "cardIcons", maxCount: 10 },
]);

// ADMIN
router.post(
  "/project-hero",
  authUser,
  adminMiddleware,
  upload,
  ProjectHeroController.createOrUpdate
);

// USER
router.get("/project-hero", ProjectHeroController.getHero);

export default router;