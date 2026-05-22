import jwt from "jsonwebtoken";
import userModel from "../model/user.model.js";
import { AppError } from "../utils/apiResponse.js";
import  dotenv  from 'dotenv'
import { PERMISSION_MAP } from "../config/permissionMap.js";
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

    // Reuse user object if already successfully fetched by optionalAuth
    if (req.user) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Optimize DB query by using lean() if possible, but let's just select only what's typically needed or exclude sensitive info.
    // Exclude password and otp.
    const user = await userModel.findById(decoded.id).select("-otp -password").populate("role");

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

    const role = req.user.role;

    // Debug: log role info to help diagnose populate issues
    if (!role) {
      console.error("[adminMiddleware] role is null/undefined for user:", req.user._id, "- populate may have failed or role document missing");
      return next(new AppError("Admin access required", 403));
    }

    // Accept both exact name match AND isSystemRole flag as fallback
    const isAdmin =
      role.name === "Super Admin" ||
      role.isSystemRole === true;

    if (!isAdmin) {
      console.error("[adminMiddleware] User role name:", JSON.stringify(role.name), "isSystemRole:", role.isSystemRole);
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

    const user = await userModel.findById(decoded.id).select("-otp -password").populate("role");

    if (!user || user.disable) {
      return next();
    }

    req.user = user;

    next();
  } catch (error) {
    next();
  }
};

// PERMISSION MIDDLEWARE  for routes handele paermission
export const hasPermission = (permissionName) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError("Not authorized", 401));
      }

      // Super Admin has all permissions
      if (req.user.role?.name === "Super Admin") {
        return next();
      }

      const userPermissions = req.user.role?.permissions || [];

      if (!userPermissions.includes(permissionName)) {
        return next(new AppError("You do not have permission to perform this action", 403));
      }

      next();
    } catch (error) {
      return next(new AppError("Permission check failed", 500));
    }
  };
};


// GLOBAL PERMISSION GUARD globaly used for permission check in routes
export const globalPermissionGuard = (req, res, next) => {
  try {
    const method = req.method;
    const url = req.baseUrl + req.path;

    // Find a matching pattern in PERMISSION_MAP
    let requiredPermission = null;
    
    for (const pattern in PERMISSION_MAP) {
      const regexPattern = pattern.replace(/:[^\/]+/g, "[^/]+").replace(/\//g, "\\/");
      const regex = new RegExp(`^${regexPattern}$`);
      
      if (regex.test(url)) {
        requiredPermission = PERMISSION_MAP[pattern][method];
        if (requiredPermission) break;
      }
    }

    // If this route requires a permission, enforce it
    if (requiredPermission) {
      return hasPermission(requiredPermission)(req, res, next);
    }

    next();
  } catch (error) {
    next(new AppError("Permission check failed", 500));
  }
};
