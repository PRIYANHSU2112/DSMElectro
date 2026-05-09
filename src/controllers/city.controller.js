import CityService from "../services/cityServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";
import { citySchema } from "../validators/locationValidation.js";

export default class CityController {
  // CREATE
  static async createCity(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = citySchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);

      const city = await CityService.createCity(req.body);

      return [
        { data: city },
        "City created successfully",
        201,
      ];
    });
  }

  // UPDATE
  static async updateCity(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = citySchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);

      const updated = await CityService.updateCity(
        req.params.id,
        req.body
      );

      return [
        { data: updated },
        "City updated successfully",
        200,
      ];
    });
  }

  // DELETE
  static async deleteCity(req, res) {
    return handleApiRequest(req, res, async () => {
      await CityService.deleteCity(req.params.id);

      return [
        { data: null },
        "City deleted successfully",
        200,
      ];
    });
  }

  // TOGGLE
  static async toggleCityStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const updated = await CityService.toggleCityStatus(req.params.id);

      return [
        { data: updated },
        updated.disable
          ? "City disabled successfully"
          : "City enabled successfully",
        200,
      ];
    });
  }

  // GET ALL (FIXED)
  static async getAllCities(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await CityService.getAllCities(req.query);

      return [
        {
          data: result.data,              // 👈 flat array
          pagination: result.pagination, // 👈 separate
        },
        "Cities fetched successfully",
        200,
      ];
    });
  }

  // GET BY ID
  static async getCityById(req, res) {
    return handleApiRequest(req, res, async () => {
      const city = await CityService.getCityById(req.params.id);

      return [
        { data: city },
        "City fetched successfully",
        200,
      ];
    });
  }
}