// controllers/specialOffer.controller.js
import SpecialOfferService from "../services/specialOfferServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class SpecialOfferController {

  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await SpecialOfferService.create(req.body);
      return [{ data: result }, "Special offer created successfully", 201];
    });
  }

  static async getActive(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await SpecialOfferService.getActive();
      return [{ data: result }, "Active special offers fetched"];
    });
  }

  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page, limit } = req.query;
      const result = await SpecialOfferService.getAll({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      });
      return [{ data: result }, "All special offers fetched"];
    });
  }

  static async getById(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await SpecialOfferService.getById(req.params.id);
      return [{ data: result }, "Special offer fetched"];
    });
  }

  static async deactivate(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await SpecialOfferService.deactivate(req.params.id);
      return [{ data: result }, "Special offer deactivated and items reverted"];
    });
  }
}