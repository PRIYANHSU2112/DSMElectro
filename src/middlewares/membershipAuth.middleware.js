import jwt from "jsonwebtoken";
import userModel from "../model/user.model.js";
import UserMembership from "../model/userMembership.model.js";
import { AppError } from "../utils/apiResponse.js";
import redisClient from "../config/redis.js";
import logger from "../utils/logger.js";

const JWT_SECRET = process.env.HASH_KEY || "secret123";

// Authentication Middleware with lazy membership expiration check
export const authenticateMembershipUser = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("Not authorized, no token provided", 401));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userModel.findById(decoded.id).select("-password -otp").populate("role");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.disable) {
      return next(new AppError("This user account has been disabled", 403));
    }

    // Attach user to request
    req.user = user;

    // LAZY MEMBERSHIP EXPIRATION CHECK
    const cacheKey = `membership:user:${user._id}`;
    let cachedMembership = null;

    // Try to get from Redis if available
    try {
      if (redisClient.status === "ready") {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          cachedMembership = JSON.parse(cachedData);
        }
      }
    } catch (err) {
      logger.warn(`Redis get failed in middleware: ${err.message}`);
    }

    let activeMembership = null;

    if (cachedMembership) {
      // If cached as "none", user has no active membership
      if (cachedMembership !== "none") {
        activeMembership = cachedMembership;
      }
    } else {
      // Fetch from DB
      activeMembership = await UserMembership.findOne({
        user_id: user._id,
        status: "active",
      }).populate("plan_id");

      if (activeMembership) {
        // Perform lazy check
        const now = new Date();
        if (new Date(activeMembership.expiry_date) < now) {
          // Silently mark expired in DB
          activeMembership.status = "expired";
          await activeMembership.save();
          
          activeMembership = null;

          // Set to "none" in cache
          try {
            if (redisClient.status === "ready") {
              await redisClient.set(cacheKey, JSON.stringify("none"), "EX", 3600);
            }
          } catch (err) {
            logger.warn(`Redis set failed: ${err.message}`);
          }
        } else {
          // Cache successful active membership for 1 hour
          try {
            if (redisClient.status === "ready") {
              await redisClient.set(cacheKey, JSON.stringify(activeMembership), "EX", 3600);
            }
          } catch (err) {
            logger.warn(`Redis set failed: ${err.message}`);
          }
        }
      } else {
        // Cache as "none" for 1 hour
        try {
          if (redisClient.status === "ready") {
            await redisClient.set(cacheKey, JSON.stringify("none"), "EX", 3600);
          }
        } catch (err) {
          logger.warn(`Redis set failed: ${err.message}`);
        }
      }
    }

    // Attach membership details to request user object
    req.user.activeMembership = activeMembership;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Session expired, please login again", 401));
    }
    return next(new AppError("Not authorized, invalid token", 401));
  }
};

// Route Guard: Requires user to have a valid active membership
export const requireActiveMembership = (req, res, next) => {
  if (!req.user || !req.user.activeMembership) {
    return next(new AppError("Active membership subscription required to access this resource", 403));
  }
  next();
};

// Route Guard: Admin only
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Not authorized", 401));
  }

  const roleName = req.user.role?.name || "";
  const isAdmin = roleName === "Super Admin" || roleName === "Admin" || req.user.email?.toLowerCase() === "admin@admin.com";

  if (!isAdmin) {
    return next(new AppError("Admin access required", 403));
  }

  next();
};
