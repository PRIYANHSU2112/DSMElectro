import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import userModel from "../model/user.model.js";
import {
  AppError,
  ValidationError,
  handleApiRequest,
} from "../utils/apiResponse.js";
import { verifyOtpSchema } from "../validators/userValidation.js";
import AuthService from "../services/authServices.js";

const JWT_SECRET = process.env.HASH_KEY || "secret123";

export default class AuthController {
  //  REGISTER + LOGIN
  static async registerAndLoginUser(req, res) {
    return handleApiRequest(req, res, async () => {
      const { number, firstName, lastName, email, fcmToken } = req.body;

      if (!number) {
        throw new ValidationError("Phone number is required");
      }

      let user = await userModel.findOne({ number });

      const otp = "1234";
      const expiry = new Date(Date.now() + 5 * 60 * 1000);

      if (user) {
        user.otp = {
          code: otp,
          expiresAt: expiry,
        };
        user.fcmToken = fcmToken || user.fcmToken;
        await user.save();
      } else {
        const userRole = await mongoose.model("Role").findOne({ name: "User" });
        user = await userModel.create({
          firstName,
          lastName,
          email,
          number,
          fcmToken,
          role: userRole?._id,
          otp: {
            code: otp,
            expiresAt: expiry,
          },
        });
      }

      console.log("OTP:", otp);

      return [
        {
          data: user,
        },
        "OTP sent successfully",
        200,
      ];
    });
  }

  //  VERIFY OTP + LOGIN
  static async verifyOtp(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = verifyOtpSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const { number, otp } = req.body;

      const user = await userModel.findOne({ number });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.otp || !user.otp.code) {
        throw new AppError("OTP not found", 400);
      }

      if (user.otp.expiresAt < new Date()) {
        throw new AppError("OTP expired", 400);
      }

      if (otp !== user.otp.code) {
        throw new AppError("Invalid OTP", 400);
      }

      user.otp = null;
      await user.save();

      const token = jwt.sign({ id: user._id }, JWT_SECRET, {
        expiresIn: "60d",
      });

      return [
        {
          data: user,
          token: token,
        },
        "OTP verified successfully",
        200,
      ];
    });
  }

  static async updateUser(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.params.id;

      const updatedUser = await AuthService.updateUser(userId, req.body);

      return [{ data: updatedUser }, "User updated successfully", 200];
    });
  }

  // DELETE USER
  static async deleteUser(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.params.id;

      await AuthService.deleteUser(userId);

      return [{}, "User deleted successfully", 200];
    });
  }

  // ENABLE / DISABLE USER

  static async toggleUserStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.params.userId;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError("Invalid userId");
      }

      const user = await AuthService.toggleUserStatus(userId);

      return [
        { data: user },
        user.disable
          ? "User disabled successfully"
          : "User enabled successfully",
        200,
      ];
    });
  }
  // ADMIN REGISTER + LOGIN
  static async adminLoginRegister(req, res) {
    return handleApiRequest(req, res, async () => {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        throw new ValidationError("Email and password are required");
      }

      const result = await AuthService.adminLoginRegister(req.body);

      return [
        {
          data: result.user,
          token: result.token,
        },
        result.isNew
          ? "Admin registered successfully"
          : "Admin login successful",
        result.isNew ? 201 : 200,
      ];
    });
  }

  // CREATE ADMIN
  static async createAdmin(req, res) {
    return handleApiRequest(req, res, async () => {
      const { fullName, email, phone, role } = req.body;
      if (!fullName || !email || !phone || !role) {
        throw new ValidationError("Full name, email, phone, and role are required");
      }
      const admin = await AuthService.createAdminUser(req.body);
      return [{ data: admin }, "Admin created successfully", 201];
    });
  }

  //  GET ALL USERS

  // ================= GET ALL USERS =================
  static async getAllUsers(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AuthService.getAllUsers(req.query);

      return [
        {
          data: result.users,
          pagination: result.pagination,
        },
        "Users fetched successfully",
        200,
      ];
    });
  }

  //  GET USER BY ID
  static async getUserById(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.params.id;

      const user = await AuthService.getUserById(userId);

      return [{ data: user }, "User fetched successfully", 200];
    });
  }
}
