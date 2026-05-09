import express from "express";
import CompanyController from "../controllers/company.controller.js";
import { adminMiddleware, authUser } from "../middlewares/authMiddleware.js";
import { upload, imageValidation } from "../middlewares/multerMiddleware.js";
import {
  setShippingConfig,
  getShippingConfig,
} from "../controllers/shippingConfig.controller.js";

const router = express.Router();

// ─── Company ──────────────────────────────────────────────────────────────────
router.get("/company", CompanyController.getCompany);

router.put(
  "/company",
  authUser,
  adminMiddleware,
  upload.fields([
    { name: "banner", maxCount: 1 },
    { name: "loader", maxCount: 1 },
    { name: "fav_icon", maxCount: 1 },
    { name: "header_logo", maxCount: 1 },
    { name: "footer_logo", maxCount: 1 },
    { name: "signatory", maxCount: 1 },
    { name: "onboarding_images", maxCount: 10 },
  ]),
  imageValidation,
  CompanyController.updateCompany,
);

// ─── Shipping config ──────────────────────────────────────────────────────────
// Public — frontend uses this to show "Free delivery above ₹X" banners
router.get("/shipping-config", getShippingConfig);

// Admin only — set flat rates and/or free-delivery thresholds
router.post(
  "/admin/shipping-config",
  authUser,
  adminMiddleware,
  setShippingConfig,
);

export default router;
