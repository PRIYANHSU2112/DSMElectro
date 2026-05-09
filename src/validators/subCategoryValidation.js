// validators/subCategoryValidation.js

import Joi from "joi";

export const subCategorySchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().allow("").optional(),
  category: Joi.string().required(),
});

export const updateSubCategorySchema = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().allow("").optional(),
  category: Joi.string().optional(),
  disable: Joi.boolean().optional(),
});