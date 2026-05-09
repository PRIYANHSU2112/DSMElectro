// routes/country.routes.js

import express from "express";
import CountryController from "../controllers/country.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ─── ADMIN ROUTES ─────────────────────────────────────────

// Create Country
router.post(
  "/country",
  authUser,
  adminMiddleware,
  CountryController.createCountry
);

// Update Country
router.put(
  "/country/:id",
  authUser,
  adminMiddleware,
  CountryController.updateCountry
);

// Delete Country
router.delete(
  "/country/:id",
  authUser,
  adminMiddleware,
  CountryController.deleteCountry
);

// Enable / Disable Country
router.patch(
  "/country/:id/toggle",
  authUser,
  adminMiddleware,
  CountryController.toggleCountryStatus
);

// ─── PUBLIC ROUTES ───────────────────────────────────────

// Get All Countries
router.get("/countries", CountryController.getAllCountries);

// Get Country By ID
router.get("/country/:id", CountryController.getCountryById);

export default router;