import Joi from "joi";

export const createBannerSchema = Joi.object({
  title: Joi.string().required(),
  redirectUrl: Joi.string().uri().allow("", null).optional(),
  page: Joi.string().required(),
  position: Joi.number().integer().min(1).required(),
  isActive: Joi.boolean().default(true),
  startDate: Joi.date().allow(null).optional(),
  endDate: Joi.date().allow(null).optional(),
});

export const updateBannerSchema = Joi.object({
  title: Joi.string().optional(),
  redirectUrl: Joi.string().uri().allow("", null).optional(),
  page: Joi.string().optional(),
  position: Joi.number().integer().min(1).optional(),
  isActive: Joi.boolean().optional(),
  startDate: Joi.date().allow(null).optional(),
  endDate: Joi.date().allow(null).optional(),
});

export const reorderBannersSchema = Joi.object({
  page: Joi.string().required(),
  banners: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().length(24).hex().required(),
        position: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
});
