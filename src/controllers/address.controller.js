import { handleApiRequest } from "../utils/apiResponse.js";
import AddressService from "../services/addressServices.js";

export default class AddressController {
  /**
   * POST /address
   */
  static async createAddress(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;
      const data = await AddressService.createAddress(userId, req.body);
      return [{ data }, "Address created successfully", 201];
    });
  }

  /**
   * GET /address
   */
  static async getAddresses(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;
      const data = await AddressService.getAddressesByUser(userId);
      return [{ data }, "Addresses fetched successfully"];
    });
  }

  /**
   * GET /address/:id
   */
  static async getAddressById(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;
      const data = await AddressService.getAddressById(req.params.id, userId);
      return [{ data }, "Address fetched successfully"];
    });
  }

  /**
   * PUT /address/:id
   */
  static async updateAddress(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;
      const data = await AddressService.updateAddress(req.params.id, userId, req.body);
      return [{ data }, "Address updated successfully"];
    });
  }

  /**
   * DELETE /address/:id
   */
  static async deleteAddress(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;
      await AddressService.deleteAddress(req.params.id, userId);
      return [{}, "Address deleted successfully"];
    });
  }
}
