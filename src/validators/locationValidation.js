import Joi from "joi";
import mongoose from "mongoose";

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message("Invalid ObjectId");
  }
  return value;
};

// COUNTRY
export const countrySchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().optional(),
  disable: Joi.boolean().optional(),
});

// STATE
export const stateSchema = Joi.object({
  name: Joi.string().required(),
  countryId: Joi.string().custom(objectId).required(),
  code: Joi.string().optional(),
  disable: Joi.boolean().optional(),
});

// CITY
export const citySchema = Joi.object({
  name: Joi.string().required(),
  stateId: Joi.string().custom(objectId).required(),
  countryId: Joi.string().custom(objectId).required(),
  disable: Joi.boolean().optional(),
});

// PINCODE
export const pincodeSchema = Joi.object({
  code: Joi.string().required(),
  cityId: Joi.string().custom(objectId).required(),
  stateId: Joi.string().custom(objectId).required(),
  countryId: Joi.string().custom(objectId).required(),
  disable: Joi.boolean().optional(),
});