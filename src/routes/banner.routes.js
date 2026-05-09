import express from "express";
import BannerController from "../controllers/banner.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();
const uploadImage = ObjectStorageService.s3Uploader().fields([
  { name: "image", maxCount: 1 },
]);

// Admin routes
router.post(
  "/",
  authUser,
  adminMiddleware,
  uploadImage,
  BannerController.createBanner
);

router.get("/all", authUser, adminMiddleware, BannerController.getAllBanners);

router.patch(
  "/:id",
  authUser,
  adminMiddleware,
  uploadImage,
  BannerController.updateBanner
);

router.delete("/:id", authUser, adminMiddleware, BannerController.deleteBanner);

router.post(
  "/reorder",
  authUser,
  adminMiddleware,
  BannerController.reorderBanners
);

// Public route for frontend
router.get("/active", BannerController.getActiveBanners);

export default router;
