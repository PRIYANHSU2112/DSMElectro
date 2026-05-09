import express from "express";
import VariantController from "../controllers/variant.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/variant", authUser, adminMiddleware, VariantController.create);
router.put("/variant/:id", authUser, adminMiddleware, VariantController.update);
router.delete(
  "/variant/:id",
  authUser,
  adminMiddleware,
  VariantController.delete,
);
router.patch(
  "/variant/:id/toggle",
  adminMiddleware,
  authUser,
  VariantController.toggle,
);

router.get("/variant/:id", authUser, VariantController.getById);
router.get("/variants", VariantController.getAll);

router.get(
  "/variants/admin",
  authUser,
  adminMiddleware,
  VariantController.getVariantsAdmin,
);

router.get(
  "/variants/product/:productId",
  authUser,
  VariantController.getByProduct,
);

export default router;
