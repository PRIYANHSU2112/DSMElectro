// routes/coin.routes.js

import express from "express";
import CoinController from "../controllers/coin.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";
// import { isAdmin } from "../middlewares/adminMiddleware.js"; // optional

const router = express.Router();

// ✅ Get config
router.get("/coin/config", authUser, CoinController.getConfig);

// ✅ Update config (admin only ideally)
router.put("/coin/config", authUser, CoinController.updateConfig);

// ✅ Test conversion
router.get("/coin/convert", authUser, CoinController.convert);

export default router;