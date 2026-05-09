import express from "express";
import AddressController from "../controllers/address.controller.js";
import { authUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authUser); // All address routes require authentication

router.post("/address", AddressController.createAddress);
router.get("/address", AddressController.getAddresses);
router.get("/address/:id", AddressController.getAddressById);
router.put("/address/:id", AddressController.updateAddress);
router.delete("/address/:id", AddressController.deleteAddress);

export default router;
