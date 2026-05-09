// controllers/atl.controller.js

import AtlService from "../services/altServices.js";
import {
  atlPageSchema,
  atlInquirySchema,
} from "../validators/altValidation.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class AtlController {
  static async upsertPage(req, res) {
    return handleApiRequest(req, res, async () => {
      const body = { ...req.body };

      // 🔥 Parse JSON
      if (body.cards) body.cards = JSON.parse(body.cards);
      if (body.setupDetails) body.setupDetails = JSON.parse(body.setupDetails);
      if (body.setProcess) body.setProcess = JSON.parse(body.setProcess);
      if (body.commonFeatures)
        body.commonFeatures = JSON.parse(body.commonFeatures);

      // ===== FILES =====

      if (req.files?.banner?.[0]) {
        body.banner = {
          url: req.files.banner[0].location,
          key: req.files.banner[0].key,
        };
      }

      if (req.files?.images) {
        body.images = req.files.images.map((f) => ({
          url: f.location,
          key: f.key,
        }));
      }

      if (req.files?.cardIcons && body.cards) {
        body.cards = body.cards.map((c, i) => ({
          ...c,
          icon: req.files.cardIcons[i]
            ? {
                url: req.files.cardIcons[i].location,
                key: req.files.cardIcons[i].key,
              }
            : c.icon,
        }));
      }

      if (req.files?.setupIcons && body.setupDetails) {
        body.setupDetails = body.setupDetails.map((s, i) => ({
          ...s,
          setupIcon: req.files.setupIcons[i]
            ? {
                url: req.files.setupIcons[i].location,
                key: req.files.setupIcons[i].key,
              }
            : s.setupIcon,
        }));
      }

      if (req.files?.processIcons && body.setProcess) {
        body.setProcess = body.setProcess.map((p, i) => ({
          ...p,
          processIcon: req.files.processIcons[i]
            ? {
                url: req.files.processIcons[i].location,
                key: req.files.processIcons[i].key,
              }
            : p.processIcon,
        }));
      }

      const { error } = atlPageSchema.validate(body);
      if (error) throw error;

      return await AtlService.upsertPage(body);
    });
  }

  static async getPage(req, res) {
    return handleApiRequest(req, res, async () => {
      return await AtlService.getPage();
    });
  }

  static async createInquiry(req, res) {
    return handleApiRequest(req, res, async () => {
      const body = { ...req.body };
      body.areaSqFt = Number(body.areaSqFt);

      const { error } = atlInquirySchema.validate(body);
      if (error) throw error;

      return await AtlService.createInquiry(body);
    });
  }

  static async getInquiries(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page = 1, limit = 10, city, budgetRange } = req.query;

      return await AtlService.getInquiries({
        page: Number(page),
        limit: Number(limit),
        city,
        budgetRange,
      });
    });
  }
}
