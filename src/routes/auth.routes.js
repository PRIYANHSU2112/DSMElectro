import express from "express";
import AuthController from "../controllers/auth.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Send OTP (Register/Login)
router.post("/registerLoginUser", AuthController.registerAndLoginUser);

// Verify OTP
router.post("/verify-otp", AuthController.verifyOtp);

// UPDATE USER
router.put("/user/:id", authUser, AuthController.updateUser);

// DELETE USER
router.delete("/user/:id", authUser, AuthController.deleteUser);

// ENABLE / DISABLE USER
router.patch(
  "/user/:userId/status",
  authUser,
  adminMiddleware,
  AuthController.toggleUserStatus,
);

router.post("/admin/registerLogin", AuthController.adminLoginRegister);
router.post("/admin/create", authUser, adminMiddleware, AuthController.createAdmin);

// GET ALL USERS
router.get("/users", authUser, adminMiddleware, AuthController.getAllUsers);

// GET USER BY ID
router.get("/user/:id", authUser, AuthController.getUserById);

export default router;
