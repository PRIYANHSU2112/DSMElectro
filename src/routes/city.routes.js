import express from "express";
import CityController from "../controllers/city.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// CREATE
router.post("/city", authUser, adminMiddleware, CityController.createCity);

// UPDATE
router.put("/city/:id", authUser, adminMiddleware, CityController.updateCity);

// DELETE
router.delete(
  "/city/:id",
  authUser,
  adminMiddleware,
  CityController.deleteCity,
);


// TOGGLE (recommended: auto toggle later)
router.patch(
  "/city/:id/toggle",
  authUser,
  adminMiddleware,
  CityController.toggleCityStatus,
);

// GET ALL
router.get("/cities", authUser, CityController.getAllCities);

// GET BY ID
router.get("/city/:id", authUser, CityController.getCityById);

export default router;
