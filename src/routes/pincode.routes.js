import express from "express";
import PincodeController from "../controllers/pincode.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/pincode/create",
  authUser,
  adminMiddleware,
  PincodeController.createPincode,
);

router.put(
  "/pincode/update/:id",
  authUser,
  adminMiddleware,
  PincodeController.updatePincode,
);

router.delete(
  "/pincode/delete/:id",
  authUser,
  adminMiddleware,
  PincodeController.deletePincode,
);

router.patch(
  "/pincode/toggle-status/:id",
  authUser,
  adminMiddleware,
  PincodeController.togglePincodeStatus,
);

router.get("/pincode/all", authUser, PincodeController.getAllPincodes);

router.get("/pincode/:id", authUser, PincodeController.getPincodeById);

export default router;