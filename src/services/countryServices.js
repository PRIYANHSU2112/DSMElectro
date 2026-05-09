import countryModel from "../model/country.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class CountryService {
  // CREATE
  static async createCountry(payload) {
    const country = await countryModel.create(payload);
    return country;
  }

  // UPDATE
  static async updateCountry(id, payload) {
    const country = await countryModel.findById(id);

    if (!country) throw new AppError("Country not found", 404);

    Object.assign(country, payload);
    await country.save();

    return country;
  }

  // DELETE
  static async deleteCountry(id) {
    const country = await countryModel.findById(id);

    if (!country) throw new AppError("Country not found", 404);

    await country.deleteOne();
    return true;
  }

  // TOGGLE
  static async toggleCountryStatus(id) {
    const country = await countryModel.findById(id);

    if (!country) throw new AppError("Country not found", 404);

    country.disable = !country.disable;

    await country.save();

    return country;
  }

  
  // GET ALL
  static async getAllCountries(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const data = await countryModel.find().skip(skip).limit(limit).lean();

    const total = await countryModel.countDocuments();

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

  // GET BY ID
  static async getCountryById(id) {
    const country = await countryModel.findById(id);

    if (!country) throw new AppError("Country not found", 404);

    return country;
  }
}
