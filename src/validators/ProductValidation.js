import Joi from "joi";

//  Variant Schema
const variantSchema = Joi.object({
  mrp: Joi.number().required(),
  stock: Joi.number().required(),

  size: Joi.string().optional(),
  packageDimensions: Joi.string().optional(),

  weight: Joi.object({
    value: Joi.number().required(),
    unit: Joi.string().valid("g", "kg", "lb").default("kg"),
  }).required(),

  discount: Joi.number().min(0).optional(),
  discountAmount: Joi.number().min(0).optional(),
  hotDeal: Joi.boolean().optional(),
});

export const createProductWithVariantSchema = Joi.object({
  name: Joi.string().trim().required(),

  slug: Joi.string().trim().lowercase().optional(),

  categoryId: Joi.string().length(24).hex().required(),
  subCategoryId: Joi.string().length(24).hex().required(),
  brandId: Joi.string().length(24).hex().required(),

  description: Joi.string().allow(""),
  minDeliveryCharge: Joi.object({
    air: Joi.number().min(0).default(0),
    road: Joi.number().min(0).default(0),
  }).optional(),

  returnInDays: Joi.number().min(0).default(0).optional(),

  keyFeatures: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        points: Joi.array().items(Joi.string()).required(),
      }),
    )
    .optional(),

  specification: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        points: Joi.array().items(Joi.string()).required(),
      }),
    )
    .optional(),

  applications: Joi.array().items(Joi.string()).optional(),

  //  ADD THIS PART ONLY (LOCATION)
  countries: Joi.array().items(Joi.string().length(24).hex()).optional(),

  states: Joi.array().items(Joi.string().length(24).hex()).optional(),

  cities: Joi.array().items(Joi.string().length(24).hex()).optional(),

  pincodes: Joi.array().items(Joi.string()).optional(),

  variant: Joi.alternatives()
    .try(variantSchema, Joi.array().items(variantSchema).min(1))
    .required(),
});
