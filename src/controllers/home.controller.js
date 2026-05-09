import { handleApiRequest } from "../utils/apiResponse.js";
import HomeService from "../services/home.service.js";

export default class HomeController {
  static async getHomePageData(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await HomeService.getHomePageData(req.query);
      return [{ data }, "Home page data fetched"];
    });
  }
}
