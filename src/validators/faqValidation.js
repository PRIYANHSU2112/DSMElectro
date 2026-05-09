import Joi from "joi";

export const createFaqSchema = Joi.object({
  question: Joi.string().min(5).required(),
  answer: Joi.string().min(5).required(),
});

export const updateFaqSchema = Joi.object({
  question: Joi.string().min(5).optional(),
  answer: Joi.string().min(5).optional(),
  isActive: Joi.boolean().optional(),
});

export const faqQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  page: Joi.number().optional(),
  limit: Joi.number().optional(),
});