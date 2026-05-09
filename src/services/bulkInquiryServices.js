import bulkInquiryModel from "../model/bulkInquiry.model.js";
import "../model/city.model.js";
import "../model/state.model.js";
import "../model/country.model.js";
import "../model/pincode.model.js";

export default class BulkInquiryService {
  // CREATE
  static async createInquiry(userId, payload) {
    return await bulkInquiryModel.create({
      userId,
      ...payload,
    });
  }

  // USER INQUIRIES
  static async getUserInquiries(userId, query = {}) {
    const { page, limit } = query;

    let dbQuery = bulkInquiryModel
      .find({ userId })
      .populate("products")
      .populate([
        { path: "city", model: "City", select: "name" },
        { path: "state", model: "State", select: "name" },
        { path: "country", model: "Country", select: "name" },
        { path: "pincode", model: "Pincode", select: "code" },
      ])
      .sort({ createdAt: -1 });

    // ✅ PAGINATION (OPTIONAL)
    if (page && limit) {
      const skip = (Number(page) - 1) * Number(limit);

      const [data, total] = await Promise.all([
        dbQuery.skip(skip).limit(Number(limit)).lean(),
        bulkInquiryModel.countDocuments({ userId }),
      ]);

      return {
        data: formatBulk(data),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // ✅ NO PAGINATION
    const data = await dbQuery.lean();
    return { data: formatBulk(data) };
  }

  // ADMIN INQUIRIES
  static async getAllInquiries(query = {}) {
    const { page, limit } = query;

    let dbQuery = bulkInquiryModel
      .find()
      .populate("products userId")
      .populate([
        { path: "city", model: "City", select: "name" },
        { path: "state", model: "State", select: "name" },
        { path: "country", model: "Country", select: "name" },
        { path: "pincode", model: "Pincode", select: "code" },
      ])
      .sort({ createdAt: -1 });

    if (page && limit) {
      const skip = (Number(page) - 1) * Number(limit);

      const [data, total] = await Promise.all([
        dbQuery.skip(skip).limit(Number(limit)).lean(),
        bulkInquiryModel.countDocuments(),
      ]);

      return {
        data: formatBulk(data),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const data = await dbQuery.lean();
    return { data: formatBulk(data) };
  }

  // UPDATE STATUS
  static async updateStatus(id, status) {
    return await bulkInquiryModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
  }
}

// 🔥 FORMAT FUNCTION (CLEAN RESPONSE)
function formatBulk(data) {
  return data.map((item) => ({
    ...item,

    city: item.city?.name || null,
    state: item.state?.name || null,
    country: item.country?.name || null,
    pincode: item.pincode?.code || null,
  }));
}
