import bannerModel from "../model/banner.model.js";
import { AppError } from "../utils/apiResponse.js";
import mongoose from "mongoose";

export default class BannerService {
  static async _shiftPositionsOnInsert(page, position) {
    await bannerModel.updateMany(
      { page, position: { $gte: position }, isDeleted: false },
      { $inc: { position: 1 } }
    );
  }

  static async _shiftPositionsOnDelete(page, position) {
    await bannerModel.updateMany(
      { page, position: { $gt: position }, isDeleted: false },
      { $inc: { position: -1 } }
    );
  }

  static async createBanner(data) {
    const exists = await bannerModel.findOne({
      page: data.page,
      position: data.position,
      isDeleted: false,
    });
    if (exists) {
      await this._shiftPositionsOnInsert(data.page, data.position);
    }
    const banner = await bannerModel.create(data);
    return banner;
  }

  static async getAllBanners(query) {
    const { page, limit, search, targetPage, isActive } = query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const match = { isDeleted: false };

    if (search) match.title = { $regex: search, $options: "i" };
    if (targetPage) match.page = targetPage;
    if (isActive !== undefined) match.isActive = isActive === "true";

    const [data, total] = await Promise.all([
      bannerModel
        .find(match)
        .sort({ page: 1, position: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      bannerModel.countDocuments(match),
    ]);

    return {
      banners: data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  static async getActiveBanners(targetPage) {
    const match = { isDeleted: false, isActive: true };
    if (targetPage) match.page = targetPage;

    const now = new Date();
    match.$and = [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ];

    return bannerModel.find(match).sort({ position: 1 }).lean();
  }

  static async updateBanner(id, updateData) {
    const existing = await bannerModel.findById(id);
    if (!existing || existing.isDeleted) {
      throw new AppError("Banner not found", 404);
    }

    if (
      (updateData.position && updateData.position !== existing.position) ||
      (updateData.page && updateData.page !== existing.page)
    ) {
      const newPage = updateData.page || existing.page;
      const newPos = updateData.position || existing.position;

      await this._shiftPositionsOnDelete(existing.page, existing.position);

      const conflict = await bannerModel.findOne({
        page: newPage,
        position: newPos,
        isDeleted: false,
      });
      if (conflict) {
        await this._shiftPositionsOnInsert(newPage, newPos);
      }
    }

    const updated = await bannerModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    return updated;
  }

  static async deleteBanner(id) {
    const banner = await bannerModel.findById(id);
    if (!banner || banner.isDeleted) {
      throw new AppError("Banner not found", 404);
    }

    banner.isDeleted = true;
    banner.isActive = false;
    await banner.save();

    await this._shiftPositionsOnDelete(banner.page, banner.position);
    return true;
  }

  static async reorderBanners(page, bannersList) {
    const bulkOps = bannersList.map((item) => ({
      updateOne: {
        filter: { _id: item.id, page, isDeleted: false },
        update: { $set: { position: item.position } },
      },
    }));

    if (bulkOps.length > 0) {
      await bannerModel.bulkWrite(bulkOps);
    }
    return true;
  }
}
