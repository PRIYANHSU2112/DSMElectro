import HotDealService from "../services/hotDealServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class HotDealController {
  // POST /hot-deal  — Create a new hot deal
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.create(req.body);
      return [{ data: result }, "Hot deal created successfully", 201];
    });
  }

  // PATCH /hot-deal/:id  — Update title, dates, discount, isActive
  static async update(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.update(req.params.id, req.body);
      return [{ data: result }, "Hot deal updated successfully"];
    });
  }

  // PATCH /hot-deal/:id/add-items  — Add products/variants/combos
  static async addItems(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.addItems(req.params.id, req.body);
      return [{ data: result }, "Items added to hot deal"];
    });
  }

  // PATCH /hot-deal/:id/remove-items  — Remove products/variants/combos
  static async removeItems(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.removeItems(req.params.id, req.body);
      return [{ data: result }, "Items removed from hot deal"];
    });
  }

  // GET /hot-deals/all  — Admin: get all deals (paginated + search)
  //   Query: ?page=1&limit=10&search=sale&status=active|inactive
  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page, limit, search, status } = req.query;
      const result = await HotDealService.getAll({ page, limit, search, status });
      return [
        { data: result.deals, pagination: result.pagination },
        "All hot deals fetched",
      ];
    });
  }

  // GET /hot-deal/:id  — Get single deal with ALL products, variants & combos
  static async getById(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.getById(req.params.id);
      return [{ data: result }, "Hot deal fetched"];
    });
  }

  // GET /hot-deals  — Public: get active deals (paginated + search)
  //   Query: ?page=1&limit=10&search=keyword
  static async getActive(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page, limit, search } = req.query;
      const result = await HotDealService.getActiveDeals({ page, limit, search });
      return [
        { data: result.deals, pagination: result.pagination },
        "Active hot deals fetched",
      ];
    });
  }

  // PATCH /hot-deal/:id/toggle-status  — Activate or Deactivate
  static async toggleStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.toggleStatus(req.params.id);
      const msg = result.isActive ? "Hot deal activated" : "Hot deal deactivated";
      return [{ data: result }, msg];
    });
  }
}
