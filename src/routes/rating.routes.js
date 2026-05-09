import express from "express";
import RatingController from "../controllers/rating.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/rating", authUser, RatingController.addRating);

router.get("/rating/:productId", authUser, RatingController.getRatings);

export default router;