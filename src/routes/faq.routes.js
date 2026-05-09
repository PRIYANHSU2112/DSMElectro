import express from "express";
import FaqController from "../controllers/faq.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

// CREATE
router.post("/faq", authUser, FaqController.create);

// GET ALL + SEARCH
router.get("/faq", FaqController.getAll);

// GET SINGLE
router.get("/faq/:id", FaqController.getById);

// UPDATE
router.put("/faq/:id", authUser, FaqController.update);

// DELETE
router.delete("/faq/:id", authUser, FaqController.delete);

export default router;
