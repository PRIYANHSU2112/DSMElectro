import Joi from "joi";
import mongoose from "mongoose";

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message("Invalid ObjectId");
  }
  return value;
};

/** Step 1 (logged-out): send OTP — name + phone only */
export const bulkInquiryOtpRequestSchema = Joi.object({
  firstName: Joi.string().trim().required(),
  lastName: Joi.string().trim().required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .message("Phone number must be 10 digits")
    .required(),
});

/** Step 2 (logged-out): verify OTP — before Submit */
export const bulkInquiryVerifyOtpSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .message("Phone number must be 10 digits")
    .required(),
  otp: Joi.any()
    .required()
    .custom((value, helpers) => {
      const s = String(value ?? "").trim();
      if (!/^[0-9]{4}$/.test(s)) {
        return helpers.error("any.invalid");
      }
      return s;
    })
    .messages({
      "any.invalid": "OTP must be exactly 4 digits",
    }),
});

/** Logged-in user: inquiry fields only */
export const bulkInquirySubmitSchema = Joi.object({
  products: Joi.array()
    .items(Joi.string().custom(objectId).required())
    .min(1)
    .required(),

  country: Joi.string().custom(objectId).required(),
  state: Joi.string().custom(objectId).required(),
  city: Joi.string().custom(objectId).required(),
  pincode: Joi.string().custom(objectId).required(),

  message: Joi.string().trim().allow("", null),

  status: Joi.string()
    .valid("pending", "contacted", "closed")
    .optional(),
});

/** Guest on POST /bulk-inquiry: name + phone + inquiry; otp on second call */
export const bulkInquiryGuestFlowSchema = Joi.object({
  firstName: Joi.string().trim().required(),
  lastName: Joi.string().trim().required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .message("Phone number must be 10 digits")
    .required(),

  otp: Joi.any()
    .optional()
    .custom((value, helpers) => {
      if (value === undefined || value === null || value === "") return undefined;
      const s = String(value).trim();
      if (!/^[0-9]{4}$/.test(s)) {
        return helpers.error("any.invalid");
      }
      return s;
    })
    .messages({
      "any.invalid": "OTP must be exactly 4 digits",
    }),

  products: Joi.array()
    .items(Joi.string().custom(objectId).required())
    .min(1)
    .required(),

  country: Joi.string().custom(objectId).required(),
  state: Joi.string().custom(objectId).required(),
  city: Joi.string().custom(objectId).required(),
  pincode: Joi.string().custom(objectId).required(),

  message: Joi.string().trim().allow("", null),

  status: Joi.string()
    .valid("pending", "contacted", "closed")
    .optional(),
});
