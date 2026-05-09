import { handleApiRequest } from "../utils/apiResponse.js";
import FaqService from "../services/faqServices.js";
import {
  createFaqSchema,
  updateFaqSchema,
  faqQuerySchema,
} from "../validators/faqValidation.js";

export default class FaqController {
  // CREATE
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = createFaqSchema.validate(req.body);
      if (error) throw error;

      const faq = await FaqService.create(req.body);

      return {
        message: "FAQ created successfully",
        data: faq,
      };
    });
  }

  // GET ALL + SEARCH
  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = faqQuerySchema.validate(req.query);
      if (error) throw error;

      const result = await FaqService.getAll(req.query);

      return {
        message: "FAQs fetched successfully",
        ...result,
      };
    });
  }

  // GET SINGLE
  static async getById(req, res) {
    return handleApiRequest(req, res, async () => {
      const faq = await FaqService.getById(req.params.id);

      if (!faq) throw new Error("FAQ not found");

      return {
        message: "FAQ fetched successfully",
        data: faq,
      };
    });
  }

  // UPDATE
  static async update(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = updateFaqSchema.validate(req.body);
      if (error) throw error;

      const faq = await FaqService.update(req.params.id, req.body);

      return {
        message: "FAQ updated successfully",
        data: faq,
      };
    });
  }

  // DELETE (SOFT)
  static async delete(req, res) {
    return handleApiRequest(req, res, async () => {
      const faq = await FaqService.delete(req.params.id);

      return {
        message: "FAQ deleted successfully",
        data: faq,
      };
    });
  }
}
