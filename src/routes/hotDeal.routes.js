import express from "express";
import HotDealController from "../controllers/hotDeal.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/hot-deal", authUser, adminMiddleware, HotDealController.create);
router.get("/hot-deals", HotDealController.getActive);

export default router;

