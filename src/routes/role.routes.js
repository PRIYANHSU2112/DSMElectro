import express from "express";
import RoleController from "../controllers/role.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All role routes require authentication and Super Admin access
router.use(authUser);
router.use(adminMiddleware);

router.get("/permissions", RoleController.getPermissions);
router.get("/roles", RoleController.getAllRoles);
router.post("/roles", RoleController.createRole);
router.put("/roles/:id", RoleController.updateRole);
router.delete("/roles/:id", RoleController.deleteRole);
router.patch("/roles/:id/permissions", RoleController.updateRolePermissions);

export default router;
