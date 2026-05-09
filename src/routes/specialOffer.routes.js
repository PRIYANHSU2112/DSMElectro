// routes/specialOffer.routes.js
import express from "express";
import SpecialOfferController from "../controllers/specialOffer.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Admin routes
router.post("/special-offer", authUser, adminMiddleware, SpecialOfferController.create);
router.get("/special-offers/all", authUser, adminMiddleware, SpecialOfferController.getAll);
router.get("/special-offer/:id", authUser, adminMiddleware, SpecialOfferController.getById);
router.patch("/special-offer/:id/deactivate", authUser, adminMiddleware, SpecialOfferController.deactivate);

// Public route
router.get("/special-offers", SpecialOfferController.getActive);

export default router;