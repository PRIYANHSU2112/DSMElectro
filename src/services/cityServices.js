import cityModel from "../model/city.model.js";
import { AppError } from "../utils/apiResponse.js";
import mongoose from "mongoose";

export default class CityService {
  static async createCity(payload) {
    return await cityModel.create(payload);
  }

  static async updateCity(id, payload) {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Invalid City ID", 400);
    const city = await cityModel.findById(id);
    if (!city) throw new AppError("City not found", 404);

    Object.assign(city, payload);
    await city.save();

    return city;
  }

  static async deleteCity(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Invalid City ID", 400);
    const city = await cityModel.findById(id);
    if (!city) throw new AppError("City not found", 404);

    await city.deleteOne();
    return true;
  }

  static async toggleCityStatus(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Invalid City ID", 400);
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
    let query;
    if (mongoose.isValidObjectId(id)) {
      query = { _id: id };
    } else {
      query = { name: { $regex: new RegExp(`^${id}$`, "i") } };
    }

    const city = await cityModel.findOne(query).populate("stateId countryId");

    if (!city) throw new AppError("City not found", 404);

    return city;
  }
}
