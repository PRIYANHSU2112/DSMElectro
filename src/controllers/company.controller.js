import { handleApiRequest } from "../utils/apiResponse.js";
import CompanyService from "../services/companyServices.js";

export default class CompanyController {
  static async getCompany(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await CompanyService.getCompany();
      return [{ data }, "Company fetched successfully"];
    });
  }

  static async updateCompany(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await CompanyService.updateCompany(req.body, req.files);
      return [{ data }, "Company updated successfully"];
    });
  }
}
