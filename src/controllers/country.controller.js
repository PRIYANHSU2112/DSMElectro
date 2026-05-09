import CountryService from "../services/countryServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";
import { countrySchema } from "../validators/locationValidation.js";

export default class CountryController {
  // CREATE
  static async createCountry(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = countrySchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);

      const country = await CountryService.createCountry(req.body);

      return [{ data: country }, "Country created successfully", 201];
    });
  }

  // UPDATE
  static async updateCountry(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = countrySchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);

      const updated = await CountryService.updateCountry(
        req.params.id,
        req.body,
      );

      return [{ data: updated }, "Country updated successfully", 200];
    });
  }

  // DELETE
  static async deleteCountry(req, res) {
    return handleApiRequest(req, res, async () => {
      await CountryService.deleteCountry(req.params.id);

      return [{ data: null }, "Country deleted successfully", 200];
    });
  }

  // TOGGLE
  static async toggleCountryStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const updated = await CountryService.toggleCountryStatus(req.params.id);

      return [
        { data: updated },
        updated.disable
          ? "Country disabled successfully"
          : "Country enabled successfully",
        200,
      ];
    });
  }

  // GET ALL
  static async getAllCountries(req, res) {
    return handleApiRequest(req, res, async () => {
      const countries = await CountryService.getAllCountries(req.query);

      return [{ data: countries }, "Countries fetched successfully", 200];
    });
  }

  // GET BY ID
  static async getCountryById(req, res) {
    return handleApiRequest(req, res, async () => {
      const country = await CountryService.getCountryById(req.params.id);

      return [{ data: country }, "Country fetched successfully", 200];
    });
  }
}
