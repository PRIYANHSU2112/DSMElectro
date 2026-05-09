import FAQ from "../model/faq.model.js";

export default class FaqService {
  
  // CREATE
  static async create(data) {
    return await FAQ.create(data);
  }

  // GET ALL (WITH SEARCH + PAGINATION)
  static async getAll(query) {
    const { search = "", page = 1, limit = 10 } = query;

    const filter = {
      isActive: true,
      question: { $regex: search, $options: "i" }, // 🔍 search by question
    };

    const skip = (page - 1) * limit;

    const [faqs, total] = await Promise.all([
      FAQ.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),

      FAQ.countDocuments(filter),
    ]);

    return {
      data: faqs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // GET SINGLE
  static async getById(id) {
    return await FAQ.findById(id);
  }

  // UPDATE
  static async update(id, data) {
    return await FAQ.findByIdAndUpdate(id, data, { new: true });
  }

  // DELETE (SOFT DELETE)
  static async delete(id) {
    return await FAQ.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
}