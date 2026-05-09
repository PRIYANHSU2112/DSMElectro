import pincodeModel from "../model/pincode.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class PincodeService {
  static async createPincode(payload) {
    try {
      if (Array.isArray(payload)) {
        return await pincodeModel.insertMany(payload, {
          ordered: false, // 🔥 allows skipping duplicates
        });
      } else {
        return await pincodeModel.create(payload);
      }
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError("Duplicate pincode for same city", 400);
      }
      throw error;
    }
  }

  static async deletePincode(id) {
    const pin = await pincodeModel.findById(id);
    if (!pin) throw new AppError("Pincode not found", 404);

    await pin.deleteOne();
    return true;
  }

  static async togglePincodeStatus(id, disable) {
    const pin = await pincodeModel.findById(id);
    if (!pin) throw new AppError("Pincode not found", 404);

    pin.disable = disable;
    await pin.save();

    return pin;
  }

  static async getAllPincodes(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const data = await pincodeModel
      .find()
      .populate("cityId stateId countryId", "name")
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await pincodeModel.countDocuments();

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

  static async getPincodeById(id) {
    const pin = await pincodeModel
      .findById(id)
      .populate("cityId stateId countryId");

    if (!pin) throw new AppError("Pincode not found", 404);

    return pin;
  }
}
