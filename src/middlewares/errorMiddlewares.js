

import { AppError } from "../utils/apiResponse.js";

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };

  error.message = err.message;

  //  MongoDB Cast Error (invalid ObjectId)
  if (err.name === "CastError") {
    error = new AppError("Invalid ID format", 400);
  }

  //  MongoDB Duplicate Key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    error = new AppError(`${field} already exists`, 409);
  }

  //  Mongoose Validation Error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    error = new AppError(messages.join(", "), 400);
  }

  //  Default fallback
  res.status(error.statusCode || error.status || 500).json({
    success: false,
    message: error.message || "Internal Server Error",
  });
};