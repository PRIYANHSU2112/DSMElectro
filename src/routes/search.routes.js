import express from "express";
import SearchController from "../controllers/search.controller.js";

const router = express.Router();

router.get("/search", SearchController.globalSearch);

export default router;
