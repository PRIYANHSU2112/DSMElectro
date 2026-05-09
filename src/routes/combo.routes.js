import express from "express";
import ComboController from "../controllers/combo.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

router.post(
    "/combo",
    authUser,
    adminMiddleware,
    ObjectStorageService.s3Uploader().fields([
        { name: "icon", maxCount: 1 },
        { name: "banner", maxCount: 1 },
        { name: "images", maxCount: 5 },
    ]),
    ComboController.createCombo,
);

router.get("/combo", authUser, ComboController.getAllCombos);

// ADMIN: get all combos (enabled/disabled/all) + optional pagination
// query params: ?status=enabled|disabled  &search=  &page=  &limit=
router.get("/combo/admin", authUser, adminMiddleware, ComboController.getAllCombosAdmin);

router.get("/combo/:id", authUser, ComboController.getComboById);

router.put(
    "/combo/:id",
    authUser,
    adminMiddleware,
    ComboController.updateCombo,
);

router.delete(
    "/combo/:id",
    authUser,
    adminMiddleware,
    ComboController.deleteCombo,
);


router.patch(
    "/combo/:id/toggle-disable",
    authUser,
    adminMiddleware,
    ComboController.toggleDisableCombo
);

export default router;