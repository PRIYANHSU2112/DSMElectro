import Joi from "joi";

export const addWishlistSchema = Joi.object({
  product: Joi.string().optional(),
  variant: Joi.string().optional(),
});

export const removeWishlistSchema = Joi.object({
  product: Joi.string().optional(),
  variant: Joi.string().optional(),
});