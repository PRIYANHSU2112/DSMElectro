// controllers/atl.controller.js

import AtlService from "../services/altServices.js";
import {
  atlPageSchema,
  atlInquirySchema,
} from "../validators/altValidation.js";
import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";

// Helper to safely parse incoming stringified JSON fields from multipart forms
const parseJsonFields = (body, fields) => {
  fields.forEach((key) => {
    if (body[key] !== undefined && typeof body[key] === "string") {
      try {
        body[key] = JSON.parse(body[key]);
      } catch (_) {
        throw new ValidationError(`Invalid JSON format for field: ${key}`);
      }
    }
  });
  return body;
};

const JSON_FIELDS = ["cards", "setupDetails", "setProcess", "commonFeatures"];

export default class AtlController {
  // 1. Original untouched upsertPage API
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

  // 2. Brand-new optimized PUT API
  static async updatePagePut(req, res) {
    return handleApiRequest(req, res, async () => {
      const body = parseJsonFields({ ...req.body }, JSON_FIELDS);

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

      if (body.cards) {
        body.cards = body.cards.map((c, i) => {
          let icon = c.icon;
          if (req.files?.cardIcons) {
            if (c.newIconIndex !== undefined && req.files.cardIcons[c.newIconIndex]) {
              icon = {
                url: req.files.cardIcons[c.newIconIndex].location,
                key: req.files.cardIcons[c.newIconIndex].key,
              };
            } else if (c.isNewIcon && req.files.cardIcons[i]) {
              icon = {
                url: req.files.cardIcons[i].location,
                key: req.files.cardIcons[i].key,
              };
            }
          }
          delete c.newIconIndex;
          delete c.isNewIcon;
          return { ...c, icon };
        });
      }

      if (body.setupDetails) {
        body.setupDetails = body.setupDetails.map((s, i) => {
          let setupIcon = s.setupIcon;
          if (req.files?.setupIcons) {
            if (s.newIconIndex !== undefined && req.files.setupIcons[s.newIconIndex]) {
              setupIcon = {
                url: req.files.setupIcons[s.newIconIndex].location,
                key: req.files.setupIcons[s.newIconIndex].key,
              };
            } else if (s.isNewIcon && req.files.setupIcons[i]) {
              setupIcon = {
                url: req.files.setupIcons[i].location,
                key: req.files.setupIcons[i].key,
              };
            }
          }
          delete s.newIconIndex;
          delete s.isNewIcon;
          return { ...s, setupIcon };
        });
      }

      if (body.setProcess) {
        body.setProcess = body.setProcess.map((p, i) => {
          let processIcon = p.processIcon;
          if (req.files?.processIcons) {
            if (p.newIconIndex !== undefined && req.files.processIcons[p.newIconIndex]) {
              processIcon = {
                url: req.files.processIcons[p.newIconIndex].location,
                key: req.files.processIcons[p.newIconIndex].key,
              };
            } else if (p.isNewIcon && req.files.processIcons[i]) {
              processIcon = {
                url: req.files.processIcons[i].location,
                key: req.files.processIcons[i].key,
              };
            }
          }
          delete p.newIconIndex;
          delete p.isNewIcon;
          return { ...p, processIcon };
        });
      }

      const { error } = atlPageSchema.validate(body);
      if (error) throw new ValidationError(error.details[0].message);

      return await AtlService.upsertPage(body);
    });
  }

  // Core view and inquiry methods
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
