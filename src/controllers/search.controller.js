import { handleApiRequest } from "../utils/apiResponse.js";
import SearchService from "../services/searchServices.js";

export default class SearchController {
  static async globalSearch(req, res) {
    console.log("Global Search Hit:", req.query);
    return handleApiRequest(req, res, async () => {
      const result = await SearchService.globalSearch(req.query);
      return [{ data: result }, "Search results fetched successfully"];
    });
  }
}
