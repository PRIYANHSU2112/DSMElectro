import HotDealService from "../services/hotDealServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class HotDealController {
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.create(req.body);
      return [{ data: result }, "Hot deal created", 201];
    });
  }

  static async getActive(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await HotDealService.getActiveDeals();
      return [{ data: result }, "Active deals fetched"];
    });
  }
}
