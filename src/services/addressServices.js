import addressModel from "../model/address.model.js";
import redisClient from "../config/redis.js";
import { AppError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

export default class AddressService {
  /**
   * CREATE ADDRESS
   */
  static async createAddress(userId, data) {
    const address = await addressModel.create({
      ...data,
      userId,
    });

    await this._clearCache(userId);
    return address;
  }

  /**
   * GET ALL ADDRESSES BY USER
   */
  static async getAddressesByUser(userId) {
    const cacheKey = `addresses:${userId}`;

    // Try cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.warn(`Redis get error: ${err.message}`);
    }

    // Database fetch
    const addresses = await addressModel
      .find({ userId })
      .populate("country", "name")
      .populate("state", "name")
      .populate("city", "name")
      .populate("pincode", "code")
      .lean();

    // Set cache
    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(addresses)); // 1 hour cache
    } catch (err) {
      logger.warn(`Redis set error: ${err.message}`);
    }

    return addresses;
  }

  /**
   * GET SINGLE ADDRESS
   */
  static async getAddressById(addressId, userId) {
    const address = await addressModel
      .findOne({ _id: addressId, userId })
      .populate("country", "name")
      .populate("state", "name")
      .populate("city", "name")
      .populate("pincode", "code")
      .lean();

    if (!address) throw new AppError("Address not found", 404);
    return address;
  }

  /**
   * UPDATE ADDRESS
   */
  static async updateAddress(addressId, userId, data) {
    const address = await addressModel.findOneAndUpdate(
      { _id: addressId, userId },
      { $set: data },
      { new: true }
    );

    if (!address) throw new AppError("Address not found or unauthorized", 404);

    await this._clearCache(userId);
    return address;
  }

  /**
   * DELETE ADDRESS
   */
  static async deleteAddress(addressId, userId) {
    const result = await addressModel.findOneAndDelete({ _id: addressId, userId });
    
    if (!result) throw new AppError("Address not found or unauthorized", 404);

    await this._clearCache(userId);
    return true;
  }

  /**
   * CLEAR CACHE HELPER
   */
  static async _clearCache(userId) {
    try {
      await redisClient.del(`addresses:${userId}`);
    } catch (err) {
      logger.warn(`Redis del error: ${err.message}`);
    }
  }
}
