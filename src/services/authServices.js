import userModel from "../model/user.model.js";
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
    const { firstName, lastName, email, password } = payload;

    let admin = await userModel.findOne({ email });

    //  LOGIN
    if (admin) {
      if (admin.role !== "ADMIN") {
        throw new AppError("User exists but not ADMIN. Access denied", 403);
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
    }

    //  REGISTER
    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await userModel.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: "ADMIN",
    });

    const token = jwt.sign(
      { id: newAdmin._id, role: newAdmin.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return {
      user: newAdmin,
      token,
      isNew: true,
    };
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
}
