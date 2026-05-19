import FlashSaleService from "../services/flashSaleServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class FlashSaleController {

  // POST /flash-sale — Create
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.create(req.body);
      return [{ data: result }, "Flash sale created successfully", 201];
    });
  }

  // PATCH /flash-sale/:id — Update title, dates, discount, isActive
  static async update(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.update(req.params.id, req.body);
      return [{ data: result }, "Flash sale updated successfully"];
    });
  }

  // PATCH /flash-sale/:id/add-items — Add products/variants/combos
  static async addItems(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.addItems(req.params.id, req.body);
      return [{ data: result }, "Items added to flash sale successfully"];
    });
  }

  // PATCH /flash-sale/:id/remove-items — Remove products/variants/combos
  static async removeItems(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.removeItems(req.params.id, req.body);
      return [{ data: result }, "Items removed from flash sale"];
    });
  }

  // GET /flash-sales/all — Admin: all deals (paginated + search)
  // ?page=1&limit=10&search=&status=active|inactive
  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.getAll(req.query);
      return [
        { data: result.deals, pagination: result.pagination },
        "All flash sales fetched",
      ];
    });
  }

  // GET /flash-sale/:id — Admin: single sale with all items populated
  static async getById(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.getById(req.params.id);
      return [{ data: result }, "Flash sale fetched"];
    });
  }

  // PATCH /flash-sale/:id/toggle-status — Activate or Deactivate
  static async toggleStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await FlashSaleService.toggleStatus(req.params.id);
      const msg = result.isActive ? "Flash sale activated" : "Flash sale deactivated";
      return [{ data: result }, msg];
    });
  }

  // GET /flash-sales — Public: active flash sales (paginated + search)
  // ?page=1&limit=10&search=keyword
  static async getActive(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page, limit, search } = req.query;
      const result = await FlashSaleService.getActive({ page, limit, search });
      return [
        { data: result.deals, pagination: result.pagination },
        "Active flash sales fetched",
      ];
    });
  }
}
