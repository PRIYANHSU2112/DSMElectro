import AtlPage from "../model/altPage.model.js";
import AtlInquiry from "../model/altInquiry.model.js";
import redisClient from "../config/redis.js";

const CACHE_KEY = "ATL_PAGE";

export default class AtlService {
  static async upsertPage(data) {
    const page = await AtlPage.findOne();

    let result;

    if (!page) {
      result = await AtlPage.create({ ...data, singleton: true });
    } else {
      Object.assign(page, data);
      result = await page.save();
    }

    await redisClient.del(CACHE_KEY);

    return result.toObject();
  }

  static async getPage() {
    const cached = await redisClient.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const page = await AtlPage.findOne().lean();

    if (page) {
      await redisClient.setEx(CACHE_KEY, 3600, JSON.stringify(page));
    }

    return page;
  }

  static async createInquiry(data) {
    const inquiry = await AtlInquiry.create(data);
    return inquiry.toObject();
  }

  static async getInquiries({ page = 1, limit = 10, city, budgetRange }) {
    const skip = (page - 1) * limit;

    const filter = {};

    if (city) filter.city = city;
    if (budgetRange) filter.budgetRange = budgetRange;

    const [data, total] = await Promise.all([
      AtlInquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AtlInquiry.countDocuments(filter),
    ]);

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
}
