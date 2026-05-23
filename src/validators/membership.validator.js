import Joi from "joi";
import mongoose from "mongoose";

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message("Invalid ObjectId");
  }
  return value;
};

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().pattern(/^[0-9]{10,15}$/).message("Invalid phone number format (must be 10-15 digits)").required(),
  password: Joi.string().trim().min(6).max(100).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});

export const planCreateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  tier: Joi.string().trim().valid("silver", "gold", "platinum").required(),
  price: Joi.number().min(0).required(),
  billing_cycle: Joi.string().trim().valid("monthly", "quarterly", "yearly").required(),
  discount_percent: Joi.number().min(0).max(100).default(0),
  points_multiplier: Joi.number().min(0).default(1.0),
  shipping_type: Joi.string().trim().default("standard"),
  perks: Joi.array().items(Joi.string()).default([]),
  is_active: Joi.boolean().default(true),
});

export const planUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  tier: Joi.string().trim().valid("silver", "gold", "platinum").optional(),
  price: Joi.number().min(0).optional(),
  billing_cycle: Joi.string().trim().valid("monthly", "quarterly", "yearly").optional(),
  discount_percent: Joi.number().min(0).max(100).optional(),
  points_multiplier: Joi.number().min(0).optional(),
  shipping_type: Joi.string().trim().optional(),
  perks: Joi.array().items(Joi.string()).optional(),
  is_active: Joi.boolean().optional(),
});

export const purchaseSchema = Joi.object({
  plan_id: Joi.string().custom(objectId).required(),
  payment_id: Joi.string().trim().required(),
});

export const upgradeSchema = Joi.object({
  new_plan_id: Joi.string().custom(objectId).required(),
  payment_id: Joi.string().trim().required(),
});

export const validateCouponSchema = Joi.object({
  coupon_code: Joi.string().trim().required(),
  order_amount: Joi.number().min(0).required(),
});

export const redeemPointsSchema = Joi.object({
  points: Joi.number().integer().min(1).required(),
  order_amount: Joi.number().min(0).required(),
});

export const earnPointsSchema = Joi.object({
  transaction_amount: Joi.number().min(0).required(),
});

export const subscriberFilterSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).default(10).optional(),
  tier: Joi.string().trim().valid("silver", "gold", "platinum").optional(),
  status: Joi.string().trim().valid("active", "expired", "cancelled").optional(),
  search: Joi.string().trim().allow("").optional(),
});
