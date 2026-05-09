import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import ProjectService from "../services/projectServices.js";
import { projectSchema, updateProjectSchema } from "../validators/projectValidations.js";

const parseJsonFields = (body, fields) => {
    fields.forEach((key) => {
        if (typeof body[key] === "string") {
            try { body[key] = JSON.parse(body[key]); } catch (_) { }
        }
    });
    return body;
};

const JSON_FIELDS = [
    "detailPoints",
    "specifications",
    "keyFeatures",
    "advancedFeatures",
    "applications",
    "componentUsers",
];

export default class ProjectController {
    // CREATE
    static async createProject(req, res) {
        return handleApiRequest(req, res, async () => {
            const body = parseJsonFields({ ...req.body }, JSON_FIELDS);

            const { error } = projectSchema.validate(body);
            if (error) throw new ValidationError(error.details[0].message);

            const files = req.files || {};
            const payload = {
                ...body,
                icon: files.icon?.[0]?.location || null,
                banner: files.banner?.[0]?.location || null,
                images: files.images?.map((f) => f.location) || [],
                video: files.video?.[0]?.location || null,
            };

            const data = await ProjectService.createProject(payload);
            return [{ data }, "Project created successfully", 201];
        });
    }

    // UPDATE
    static async updateProject(req, res) {
        return handleApiRequest(req, res, async () => {
            const body = parseJsonFields({ ...req.body }, JSON_FIELDS);

            const { error } = updateProjectSchema.validate(body);
            if (error) throw new ValidationError(error.details[0].message);

            const files = req.files || {};
            const payload = { ...body };
            if (files.icon?.[0]) payload.icon = files.icon[0].location;
            if (files.banner?.[0]) payload.banner = files.banner[0].location;
            if (files.images?.length) payload.images = files.images.map((f) => f.location);
            if (files.video?.[0]) payload.video = files.video[0].location;

            const data = await ProjectService.updateProject(req.params.id, payload);
            return [{ data }, "Project updated successfully"];
        });
    }

    // DELETE
    static async deleteProject(req, res) {
        return handleApiRequest(req, res, async () => {
            await ProjectService.deleteProject(req.params.id);
            return [{}, "Project deleted successfully"];
        });
    }

    // GET BY ID
    static async getProjectById(req, res) {
        return handleApiRequest(req, res, async () => {
            const data = await ProjectService.getProjectById(req.params.id);
            return [{ data }, "Project fetched successfully"];
        });
    }

    // GET ALL
    static async getAllProjects(req, res) {
        return handleApiRequest(req, res, async () => {
            const result = await ProjectService.getAllProjects(req.query);
            return [
                { data: result.projects, pagination: result.pagination },
                "Projects fetched successfully",
            ];
        });
    }

    // INCREMENT DOWNLOADS
    static async incrementDownloads(req, res) {
        return handleApiRequest(req, res, async () => {
            const data = await ProjectService.incrementDownloads(req.params.id);
            return [{ data }, "Download count updated"];
        });
    }

    // TOGGLE STATUS
    static async toggleProjectStatus(req, res) {
        return handleApiRequest(req, res, async () => {
            const data = await ProjectService.toggleProjectStatus(req.params.id);
            return [
                { data },
                data.disable ? "Project disabled successfully" : "Project enabled successfully",
            ];
        });
    }

    // GET BY CATEGORY
    static async getProjectsByCategory(req, res) {
        return handleApiRequest(req, res, async () => {
            const result = await ProjectService.getProjectsByCategory(
                req.params.categoryId,
                req.query
            );
            return [{ data: result.projects, pagination: result.pagination }, "Projects fetched successfully"];
        });
    }

    // GET BY SUBCATEGORY
    static async getProjectsBySubCategory(req, res) {
        return handleApiRequest(req, res, async () => {
            const result = await ProjectService.getProjectsBySubCategory(
                req.params.subCategoryId,
                req.query
            );
            return [{ data: result.projects, pagination: result.pagination }, "Projects fetched successfully"];
        });
    }
}