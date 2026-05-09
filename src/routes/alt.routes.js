// routes/atl.routes.js

import express from "express";
import AtlController from "../controllers/alt.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

router.post(
  "/alt/page",
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

router.get("/alt/page", AtlController.getPage);

router.post("/alt/inquiry", AtlController.createInquiry);

router.get(
  "/alt/inquiry",
  authUser,
  adminMiddleware,
  AtlController.getInquiries,
);

export default router;
