import logger from "./logger.js";

//  Base Error Class

export class AppError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    
    if (code === "INTERNAL_ERROR") {
      if (status === 400) this.code = "BAD_REQUEST";
      else if (status === 401) this.code = "UNAUTHORIZED";
      else if (status === 403) this.code = "FORBIDDEN";
      else if (status === 404) this.code = "NOT_FOUND";
      else if (status === 409) this.code = "CONFLICT";
      else this.code = code;
    } else {
      this.code = code;
    }
    
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Custom Error Types

export class ValidationError extends AppError {
  constructor(message, errors) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

// Response Builder

class ResponseBuilder {
  success(res, data, options = {}) {
    const response = {
      success: true,
      ...(data || {}),
      ...(options.message && { message: options.message }),
      ...(options.meta && { meta: options.meta }),
    };

    return res.status(options.status || 200).json(response);
  }

  error(res, message, options = {}) {
    const response = {
      success: false,
      message,
      status: options.status || 500,
      ...(options.code && { code: options.code }),
      ...(options.errors && { errors: options.errors }),
      ...(options.details &&
        process.env.NODE_ENV === "development" && {
          details: options.details,
        }),
    };

    return res.status(options.status || 500).json(response);
  }
}

export const apiResponse = new ResponseBuilder();

//   Global Error Handler

export function handleError(res, error) {
  let status = error.status || 500;
  let code = error.code || "INTERNAL_ERROR";
  let message = error.message;

  if (error instanceof AppError) {
    status = error.status;
    code = error.code;
  } else if (error instanceof SyntaxError) {
    status = 400;
    code = "SYNTAX_ERROR";
    message = "Invalid JSON format";
  } else if (error.code === 11000) {
    status = 409;
    code = "DUPLICATE_ENTRY";
  } else if (error.name === "ValidationError") {
    status = 400;
    code = "VALIDATION_ERROR";
  } else if (error.name === "CastError") {
    status = 400;
    code = "INVALID_ID";
  }

  if (status >= 500) {
    logger.error(error);
  } else {
    logger.warn({
      message: message,
      status: status,
      code: code,
      url: res.req?.originalUrl,
      userId: res.req?.user?._id,
    });
  }

  if (error instanceof AppError) {
    return apiResponse.error(res, error.message, {
      status: error.status,
      code: error.code,
      errors: error.errors,
      details: error.details,
    });
  }

  // JSON Syntax Error
  if (error instanceof SyntaxError) {
    return apiResponse.error(res, "Invalid JSON format", {
      status: 400,
      code: "SYNTAX_ERROR",
    });
  }

  // Mongo Duplicate Key
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";

    return apiResponse.error(res, `Duplicate entry for ${field}`, {
      status: 409,
      code: "DUPLICATE_ENTRY",
      details: { field },
    });
  }

  // Mongoose Validation
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => e.message);

    return apiResponse.error(res, "Validation Error", {
      status: 400,
      code: "VALIDATION_ERROR",
      errors,
    });
  }

  // Invalid Mongo ObjectId
  if (error.name === "CastError") {
    return apiResponse.error(res, "Invalid ID format", {
      status: 400,
      code: "INVALID_ID",
    });
  }

  // Default Error
  return apiResponse.error(
    res,
    process.env.NODE_ENV === "development"
      ? error.message
      : "Internal Server Error",
    {
      status: 500,
      code: "INTERNAL_ERROR",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    },
  );
}

// Controller Wrapper

export async function handleApiRequest(req, res, handler) {
  try {
    const result = await handler(req, res);

    const data = Array.isArray(result) ? result[0] : result;
    const message = Array.isArray(result) ? result[1] : "Request successful";
    const status = Array.isArray(result) ? result[2] : 200;

    return apiResponse.success(res, data, {
      message,
      status,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
