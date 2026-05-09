import jwt from "jsonwebtoken";
import userModel from "../model/user.model.js";
import { AppError } from "../utils/apiResponse.js";
import  dotenv  from 'dotenv'
dotenv.config()
const JWT_SECRET = process.env.HASH_KEY || "secret123";

// AUTH USER
export const authUser = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("Not authorized, no token", 401));
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Optimize DB query by using lean() if possible, but let's just select only what's typically needed or exclude sensitive info.
    // Exclude password and otp.
    const user = await userModel.findById(decoded.id).select("-otp -password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.disable) {
      return next(new AppError("User is disabled", 403));
    }

    req.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Not authorized, token expired", 401));
    }
    return next(new AppError("Not authorized, invalid token", 401));
  }
};

// ADMIN MIDDLEWARE
export const adminMiddleware = (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError("Not authorized", 401));
    }

    if (req.user.role !== "ADMIN") {
      return next(new AppError("Admin access required", 403));
    }

    next();
  } catch (error) {
    return next(new AppError("Authorization failed", 500));
  }
};

// OPTIONAL AUTH (NO ERROR IF TOKEN MISSING)
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await userModel.findById(decoded.id).select("-otp -password");

    if (!user || user.disable) {
      return next();
    }

    req.user = user;

    next();
  } catch (error) {
    next();
  }
};
