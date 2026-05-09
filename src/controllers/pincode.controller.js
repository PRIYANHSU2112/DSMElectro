import PincodeService from "../services/pincodeServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";
import { pincodeSchema } from "../validators/locationValidation.js";

export default class PincodeController {
  static async createPincode(req, res) {
    return handleApiRequest(req, res, async () => {
      const isArray = Array.isArray(req.body);

      if (isArray) {
        for (let item of req.body) {
          const { error } = pincodeSchema.validate(item);
          if (error) throw new Error(error.details[0].message);
        }
      } else {
        const { error } = pincodeSchema.validate(req.body);
        if (error) throw new Error(error.details[0].message);
      }

      const result = await PincodeService.createPincode(req.body);

      return [
        { data: result },
        isArray
          ? "Pincodes created successfully"
          : "Pincode created successfully",
      ];
    });
  }

  static async updatePincode(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = pincodeSchema.validate(req.body);
      if (error) throw new Error(error.details[0].message);
      return await PincodeService.updatePincode(req.params.id, req.body);
    });
  }

  static async deletePincode(req, res) {
    return handleApiRequest(req, res, async () => {
      return await PincodeService.deletePincode(req.params.id);
    });
  }

  static async togglePincodeStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      return await PincodeService.togglePincodeStatus(
        req.params.id,
        req.body.disable,
      );
    });
  }

  static async getAllPincodes(req, res) {
    return handleApiRequest(req, res, async () => {
      return await PincodeService.getAllPincodes(req.query);
    });
  }

  static async getPincodeById(req, res) {
    return handleApiRequest(req, res, async () => {
      return await PincodeService.getPincodeById(req.params.id);
    });
  }
}
