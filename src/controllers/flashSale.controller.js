import FlashSaleService from "../services/flashSaleServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class FlashSaleController {
  // ✅ CREATE FLASH SALE
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.create(req.body);
      return [{ data: result }, "Flash sale created", 201];
    });
  }

  // ✅ GET ACTIVE FLASH SALES (PUBLIC)
  static async getActive(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.getActive();
      return [{ data: result }, "Active flash sales fetched"];
    });
  }

  // 🔥 OPTIONAL (LIKE SPECIAL OFFER)

  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page, limit } = req.query;

      const result = await FlashSaleService.getAll({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      });

      return [{ data: result }, "All flash sales fetched"];
    });
  }

  static async getById(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.getById(req.params.id);
      return [{ data: result }, "Flash sale fetched"];
    });
  }

  static async deactivate(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.deactivate(req.params.id);
      return [{ data: result }, "Flash sale deactivated"];
    });
  }

  static async addItems(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.addItems(req.params.id, req.body);
      return [{ data: result }, "Items added to flash sale successfully"];
    });
  }
}
