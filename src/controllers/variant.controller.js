import VariantService from "../services/variantServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class VariantController {
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await VariantService.createVariant(req.body);
      return [{ data: result }, "Variant created", 201];
    });
  }

  static async update(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;
      const result = await VariantService.updateVariant(id, req.body);
      return [{ data: result }, "Variant updated"];
    });
  }

  static async delete(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;
      await VariantService.deleteVariant(id);
      return [{}, "Variant deleted"];
    });
  }

  static async toggle(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;

      const result = await VariantService.toggleVariant(id);

      const message = result.disable
        ? "Variant disabled successfully"
        : "Variant enabled successfully";

      return [{ data: result }, message];
    });
  }

  static async getById(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;
      const result = await VariantService.getVariantById(id);
      return [{ data: result }, "Variant fetched"];
    });
  }

  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await VariantService.getVariants(req.query);
      return [{ data: result }, "Variants fetched"];
    });
  }

  static async getVariantsAdmin(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await VariantService.getVariantsAdmin(req.query);
      return [{ data: result }, "Variants fetched"];
    });
  }

  static async getByProduct(req, res) {
    return handleApiRequest(req, res, async () => {
      const { productId } = req.params;
      const result = await VariantService.getVariantsByProduct(productId);
      return [{ data: result }, "Variants fetched by product"];
    });
  }
}
