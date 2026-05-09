import cityModel from "../model/city.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class CityService {
  static async createCity(payload) {
    return await cityModel.create(payload);
  }

  static async updateCity(id, payload) {
    const city = await cityModel.findById(id);
    if (!city) throw new AppError("City not found", 404);

    Object.assign(city, payload);
    await city.save();

    return city;
  }

  static async deleteCity(id) {
    const city = await cityModel.findById(id);
    if (!city) throw new AppError("City not found", 404);

    await city.deleteOne();
    return true;
  }

  static async toggleCityStatus(id) {
    const city = await cityModel.findById(id);
    if (!city) throw new AppError("City not found", 404);

    city.disable = !city.disable;

    await city.save();

    return city;
  }

  static async getAllCities(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const data = await cityModel
      .find()
      .populate("stateId", "name")
      .populate("countryId", "name")
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await cityModel.countDocuments();

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

  static async getCityById(id) {
    const city = await cityModel.findById(id).populate("stateId countryId");

    if (!city) throw new AppError("City not found", 404);

    return city;
  }
}
