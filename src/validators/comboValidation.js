import Joi from "joi";
export const createComboSchema = Joi.object({
  name: Joi.string().required(),
  sku: Joi.string().optional(),

  codeTab: Joi.array().items(Joi.string()).optional(),

  description: Joi.string().allow(""),

  keyFeatures: Joi.array().items(
    Joi.object({
      title: Joi.string().required(),
      points: Joi.array().items(Joi.string()).required(),
    }),
  ),

  specification: Joi.array().items(
    Joi.object({
      title: Joi.string().required(),
      points: Joi.array().items(Joi.string()).required(),
    }),
  ),

  applications: Joi.array().items(Joi.string()),
  pinConfiguration: Joi.array().items(Joi.string()),

  weight: Joi.object({
    value: Joi.number().required(),
    unit: Joi.string().valid("g", "kg", "lb").default("kg"),
  }),

  // ✅ ADD THIS
  minDeliveryCharge: Joi.object({
    air: Joi.number().min(0).required(),
    road: Joi.number().min(0).required(),
  }),

  returnInDays: Joi.number().min(0).default(0).optional(),

  items: Joi.array()
    .items(
      Joi.object({
        variantId: Joi.string().length(24).hex().required(),
        quantity: Joi.number().min(1).required(),
      }),
    )
    .required(),

  comboPrice: Joi.number().required(),
  discount: Joi.number().optional(),

  countries: Joi.array().items(Joi.string().length(24).hex()),
  states: Joi.array().items(Joi.string().length(24).hex()),
  cities: Joi.array().items(Joi.string().length(24).hex()),
  pincodes: Joi.array().items(Joi.string().length(24).hex()),
});
