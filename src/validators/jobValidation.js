// validators/job.validation.js
import Joi from "joi";

export const jobSchema = Joi.object({
  title: Joi.string().required(),
  jobType: Joi.string().valid("full-time", "part-time", "internship").required(),
  workMode: Joi.string().valid("onsite", "remote", "hybrid").required(),

  city: Joi.string().required(),
  address: Joi.string().required(),

  description: Joi.string().required(),
  roleOverview: Joi.string().required(),

  responsibilities: Joi.array().items(Joi.string()).required(),
  skills: Joi.array().items(Joi.string()).required(),
});