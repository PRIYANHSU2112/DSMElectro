// validators/atl.validation.js
import Joi from "joi";

export const atlPageSchema = Joi.object({
  banner: Joi.object(),

  heading: Joi.string().required(),
  description: Joi.string().required(),

  subTitle: Joi.string().allow(""),
  subDescription: Joi.string().allow(""),

  cards: Joi.array().items(
    Joi.object({
      icon: Joi.object(),
      title: Joi.string().required(),
      description: Joi.string().required(),
    })
  ),

  images: Joi.array(),

  commonFeatures: Joi.object({
    heading: Joi.string(),
    description: Joi.string(),
  }),

  setupDetails: Joi.array(),

  setProcess: Joi.array(),
});

export const atlInquirySchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  schoolName: Joi.string().required(),
  city: Joi.string().required(),
  areaSqFt: Joi.number().required(),
  budgetRange: Joi.string().required(),
  message: Joi.string().allow(""),
});