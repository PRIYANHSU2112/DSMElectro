import Joi from "joi";

const keyFeatureSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow("", null),
});

const possibilitySchema = Joi.object({
  point: Joi.string().required(),
});

export const blogSchema = Joi.object({
  title: Joi.string().required(),
  category: Joi.string().hex().length(24).required(),
  subCategory: Joi.string().hex().length(24).required(),
  publishDate: Joi.date().iso().optional(),
  description: Joi.string().allow("", null),
  keyFeatures: Joi.array().items(keyFeatureSchema).optional(),
  possibilities: Joi.object({
    title: Joi.string().optional(),
    points: Joi.array().items(possibilitySchema).optional(),
  }).optional(),
  details: Joi.string().allow("", null),
  conclusion: Joi.object({
    title: Joi.string().optional(),
    content: Joi.string().optional(),
  }).optional(),
});

export const updateBlogSchema = blogSchema.fork(
  ["title", "category", "subCategory"],
  (field) => field.optional()
);