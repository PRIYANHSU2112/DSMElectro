import userModel from "../model/user.model.js";
import roleModel from "../model/role.model.js";
import { SYSTEM_ROLES } from "../utils/permissions.js";
import { AppError } from "../utils/apiResponse.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv'
dotenv.config()
const JWT_SECRET = process.env.HASH_KEY || "secret123";

export default class AuthService {
  // UPDATE USER
  static async updateUser(userId, payload) {
    const user = await userModel.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    Object.assign(user, payload);

    await user.save();

    return user;
  }

  // DELETE USER
  static async deleteUser(userId) {
    const user = await userModel.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    await user.deleteOne();

    return true;
  }

  // ENABLE / DISABLE USER
  static async toggleUserStatus(userId) {
    const user = await userModel.findOneAndUpdate(
      { _id: userId },
      [
        {
          $set: {
            disable: { $not: "$disable" },
          },
        },
      ],
      {
        new: true,
        updatePipeline: true,
      },
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  static async adminLoginRegister(payload) {
    const { email, password } = payload;

    let admin = await userModel.findOne({ email }).populate("role");

    //  LOGIN
    if (admin) {
      // Log for debugging
      console.log(`Login attempt for ${email}. Role:`, admin.role);

      const hasAdminAccess = 
        admin.role || 
        admin.role === "ADMIN" || 
        email.trim().toLowerCase() === "admin@admin.com"; // Emergency fallback

      if (!hasAdminAccess) {
        throw new AppError("User exists but does not have Admin access.", 403);
      }

      if (!admin.password) {
        throw new AppError("Password not set for this admin", 400);
      }

      const isMatch = await bcrypt.compare(password, admin.password);

      if (!isMatch) {
        throw new AppError("Invalid credentials", 400);
      }

      const token = jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, {
        expiresIn: "60d",
      });

      return {
        user: admin,
        token,
        isNew: false,
      };
    } else {
      return { user: null, token: null, isNew: false, err: "User not found" };
    }
  }

  //  GET ALL USERS
  static async getAllUsers(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;

    const skip = (page - 1) * limit;

    const users = await userModel
      .find()
      .select("-password -otp -__v") // hide sensitive fields
      .skip(skip)
      .limit(limit)
      .lean(); // faster response

    const total = await userModel.countDocuments();

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  //  GET USER BY ID
  static async getUserById(userId) {
    const user = await userModel.findById(userId).populate("address");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  // CREATE ADMIN USER (OPTIMIZED)
  static async createAdminUser(payload) {
    const { fullName, email, phone, password, role, disable } = payload;

    // Check if user exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      throw new AppError("User with this email already exists", 400);
    }

    // Split fullName into firstName and lastName
    const nameParts = (fullName || "").trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    const hashedPassword = await bcrypt.hash(password || "Admin@123", 10);

    const newAdmin = await userModel.create({
      firstName,
      lastName,
      email,
      number: phone,
      password: hashedPassword,
      role,
      disable: disable || false,
    });

    return newAdmin;
  }
}
