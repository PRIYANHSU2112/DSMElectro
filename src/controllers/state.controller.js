import StateService from "../services/stateServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";
import { stateSchema } from "../validators/locationValidation.js";

export default class StateController {
  static async createState(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = stateSchema.validate(req.body);

      if (error) throw new Error(error.details[0].message);

      return [
        { data: await StateService.createState(req.body) },
        "State created successfully",
        201,
      ];
    });
  }

  static async updateState(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = stateSchema.validate(req.body);

      if (error) throw new Error(error.details[0].message);

      return [
        {
          data: await StateService.updateState(req.params.id, req.body),
        },
        "State updated successfully",
        200,
      ];
    });
  }

  static async deleteState(req, res) {
    return handleApiRequest(req, res, async () => {
      await StateService.deleteState(req.params.id);

      return [
        { data: null },
        "State deleted successfully",
        200,
      ];
    });
  }

  static async toggleStateStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const updated = await StateService.toggleStateStatus(req.params.id);

      return [
        { data: updated },
        updated.disable
          ? "State disabled successfully"
          : "State enabled successfully",
        200,
      ];
    });
  }

  static async getAllStates(req, res) {
    return handleApiRequest(req, res, async () => {
      const states = await StateService.getAllStates(req.query);

      return [
        { data: states },
        "States fetched successfully",
        200,
      ];
    });
  }

  static async getStateById(req, res) {
    return handleApiRequest(req, res, async () => {
      const state = await StateService.getStateById(req.params.id);

      return [
        { data: state },
        "State fetched successfully",
        200,
      ];
    });
  }
}