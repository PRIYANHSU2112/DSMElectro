import Joi from "joi";

const specificationSchema = Joi.object({
    key: Joi.string().required(),
    detail: Joi.string().required(),
});

const detailPointSchema = Joi.object({
    point: Joi.string().required(),
});

export const projectSchema = Joi.object({
    title: Joi.string().required(),
    category: Joi.string().hex().length(24).required(),
    subCategory: Joi.string().hex().length(24).required(),
    video: Joi.any().optional(),
    sourceCode: Joi.string().allow("", null).optional(),

    rating: Joi.number().min(0).max(5).optional(),
    totalRatings: Joi.number().min(0).optional(),
    totalViews: Joi.number().min(0).optional(),
    totalDownloads: Joi.number().min(0).optional(),
    projectType: Joi.string()
        .valid("beginner", "intermediate", "advance")
        .required(),

    mrp: Joi.number().min(0).required(),
    discount: Joi.number().min(0).max(100).optional(),

    description: Joi.string().allow("", null).optional(),
    details: Joi.string().allow("", null).optional(),
    detailPoints: Joi.array().items(detailPointSchema).optional(),
    specifications: Joi.array().items(specificationSchema).optional(),
    keyFeatures: Joi.array().items(Joi.string()).optional(),
    advancedFeatures: Joi.array().items(Joi.string()).optional(),
    applications: Joi.array().items(Joi.string()).optional(),
    componentUsers: Joi.array().items(Joi.string()).optional(),
});


export const updateProjectSchema = projectSchema.fork(
    Object.keys(projectSchema.describe().keys),
    (field) => field.optional()
);