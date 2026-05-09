import Joi from "joi";

export const ratingSchema = Joi.object({
  productId: Joi.string().required(),

  rating: Joi.number()
    .min(0)
    .max(5)
    .required()
    .messages({
      "number.base": "Rating must be a number",
      "number.min": "Rating cannot be less than 0",
      "number.max": "Rating cannot be more than 5",
    }),

  comment: Joi.string().allow("").max(500),
});