// routes/atl.routes.js

import express from "express";
import AtlController from "../controllers/alt.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

// 1. Original unchanged POST API (Untouched)
router.post(
  "/alt/page-update",
  authUser,
  adminMiddleware,
  ObjectStorageService.s3Uploader().fields([
    { name: "banner", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "cardIcons", maxCount: 20 },
    { name: "setupIcons", maxCount: 20 },
    { name: "processIcons", maxCount: 20 },
  ]),
  AtlController.upsertPage,
);

// 2. Brand-new optimized PUT API
router.put(
  "/alt/update-page",
  authUser,
  adminMiddleware,
  ObjectStorageService.s3Uploader().fields([
    { name: "banner", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "cardIcons", maxCount: 20 },
    { name: "setupIcons", maxCount: 20 },
    { name: "processIcons", maxCount: 20 },
  ]),
  AtlController.updatePagePut,
);

router.get("/alt/page", AtlController.getPage);

router.post("/alt/inquiry", AtlController.createInquiry);

router.get(
  "/alt/inquiry",
  authUser,
  adminMiddleware,
  AtlController.getInquiries,
);

export default router;
