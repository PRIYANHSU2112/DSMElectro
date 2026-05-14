import Joi from "joi";

export const brandSchema = Joi.object({
  brandName: Joi.string().trim().required(),
  category: Joi.string().hex().length(24).required(),
  subCategory: Joi.string().hex().length(24).optional(),
  icon: Joi.string().optional(),
  disable: Joi.boolean().optional(),
});

export const updateBrandSchema = Joi.object({
  brandName: Joi.string().trim().optional(),
  category: Joi.string().hex().length(24).optional(),
  subCategory: Joi.string().hex().length(24).optional(),
  icon: Joi.string().optional(),
  disable: Joi.boolean().optional(),
});
