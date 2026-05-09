import Joi from "joi";

export const categorySchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().trim().optional(),
  icon: Joi.string().optional(),
  disable: Joi.boolean().optional(),
});


export const updateCategorySchema = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().trim().optional(),
  icon: Joi.string().optional(),
  disable: Joi.boolean().optional(),
});