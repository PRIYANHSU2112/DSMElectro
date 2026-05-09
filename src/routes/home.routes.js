import express from "express";
import HomeController from "../controllers/home.controller.js";

const router = express.Router();

router.get("/home", HomeController.getHomePageData);

export default router;
