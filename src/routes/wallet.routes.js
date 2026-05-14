import express from "express";
import WalletController from "../controllers/wallet.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
 
const router = express.Router();
 
// User routes
router.get("/wallet", authUser, WalletController.getWallet);
router.post("/wallet/topup", authUser, WalletController.topUp);
router.get("/wallet/transactions", authUser, WalletController.getTransactions);
 
// Admin route
router.post("/wallet/admin/adjust", authUser, adminMiddleware, WalletController.adminAdjust);

 
export default router;