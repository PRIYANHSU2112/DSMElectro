// routes/videoGallery.routes.js

import express from "express";
import VideoGalleryController from "../controllers/videoGallery.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

// CREATE
router.post(
  "/video",
  authUser,
  adminMiddleware,
  ObjectStorageService.s3Uploader().fields([
    { name: "video", maxCount: 1 },
  ]),
  VideoGalleryController.createVideo
);

// GET
router.get("/video", VideoGalleryController.getVideos);

// 
router.post(
  "/video/:id/view",
  authUser,
  VideoGalleryController.addView
);

// DELETE
router.delete(
  "/video/:id",
  authUser,
  adminMiddleware,
  VideoGalleryController.deleteVideo
);

export default router;