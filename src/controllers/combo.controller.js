import slugify from "slugify";
import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import ComboService from "../services/combo.service.js";
import { createComboSchema } from "../validators/comboValidation.js";

export default class ComboController {
  static async createCombo(req, res) {
    return handleApiRequest(req, res, async () => {
      const body = req.body;

      const parseFields = [
        "items",
        "keyFeatures",
        "specification",
        "applications",
        "codeTab",
        "pinConfiguration",
        "countries",
        "states",
        "cities",
        "pincodes",
        "minDeliveryCharge",
      ];

      for (const field of parseFields) {
        if (body[field] && typeof body[field] === "string") {
          try {
            body[field] = JSON.parse(body[field]);
          } catch {
            throw new ValidationError(`Invalid ${field}`);
          }
        }
      }

      const { error } = createComboSchema.validate(body);
      if (error) throw new ValidationError(error.details[0].message);

      const payload = {
        ...body,
        slug: slugify(body.name, { lower: true, strict: true }),
        icon: req.files?.icon?.[0]?.location ?? null,
        banner: req.files?.banner?.[0]?.location ?? null,
        images: req.files?.images?.map((f) => f.location) ?? [],
      };

      const result = await ComboService.createCombo(payload);

      return [{ data: result }, "Combo created", 201];
    });
  }

  static async getAllCombos(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ComboService.getAllCombos(req.query);
      return [{ data: result }, "Combos fetched"];
    });
  }

  static async getAllCombosAdmin(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ComboService.getAllCombosAdmin(req.query);
      return [{ data: result }, "All combos fetched (admin)"];
    });
  }

  static async getComboById(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ComboService.getComboById(req.params.id);
      return [{ data: result }, "Combo fetched"];
    });
  }

  static async updateCombo(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ComboService.updateCombo(req.params.id, req.body);
      return [{ data: result }, "Combo updated"];
    });
  }

  static async deleteCombo(req, res) {
    return handleApiRequest(req, res, async () => {
      await ComboService.deleteCombo(req.params.id);
      return [{}, "Combo deleted"];
    });
  }

  static async toggleDisableCombo(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;

      const result = await ComboService.toggleDisableCombo(id);

      return [
        { data: result },
        `Combo ${result.disable ? "disabled" : "enabled"} successfully`,
      ];
    });
  }
}
