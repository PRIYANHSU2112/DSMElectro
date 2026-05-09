import Joi from "joi";
import mongoose from "mongoose";

// Custom validator for ObjectId
const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message("Invalid ObjectId");
  }
  return value;
};

export const userValidationSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),

  lastName: Joi.string().trim().min(2).max(50).optional(),

  email: Joi.string().trim().email().optional(),

  number: Joi.string() // better than number for phone
    .pattern(/^[0-9]{10}$/)
    .message("Phone number must be 10 digits")
    .optional(),

  fcmToken: Joi.string().trim().optional(),

  address: Joi.string().custom(objectId).optional(),
});

export const verifyOtpSchema = Joi.object({
  number: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),

  otp: Joi.string().length(4).required(),
});
