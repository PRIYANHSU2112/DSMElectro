import stateModel from "../model/state.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class StateService {
  static async createState(payload) {
    return await stateModel.create(payload);
  }

  static async updateState(id, payload) {
    const state = await stateModel.findById(id);
    if (!state) throw new AppError("State not found", 404);

    Object.assign(state, payload);
    await state.save();

    return state;
  }

  static async deleteState(id) {
    const state = await stateModel.findById(id);
    if (!state) throw new AppError("State not found", 404);

    await state.deleteOne();
    return true;
  }

  static async toggleStateStatus(id) {
    const state = await stateModel.findById(id);
    if (!state) throw new AppError("State not found", 404);

    state.disable = !state.disable;

    await state.save();

    return state;
  }

  static async getAllStates(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const data = await stateModel
      .find()
      .populate("countryId", "name")
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await stateModel.countDocuments();

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getStateById(id) {
    const state = await stateModel.findById(id).populate("countryId", "name");

    if (!state) throw new AppError("State not found", 404);

    return state;
  }
}
