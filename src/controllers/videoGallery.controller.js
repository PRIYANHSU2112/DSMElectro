// controllers/videoGallery.controller.js

import VideoGalleryService from "../services/videoGallaryServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class VideoGalleryController {
  static async createVideo(req, res) {
    return handleApiRequest(req, res, async () => {
      const body = { ...req.body };
      body.duration = Number(body.duration);

      if (req.files?.video?.[0]) {
        body.video = {
          url: req.files.video[0].location,
          key: req.files.video[0].key,
        };
      }

      return await VideoGalleryService.createVideo(body);
    });
  }

  static async getVideos(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page = 1, limit = 10 } = req.query;

      return await VideoGalleryService.getVideos({
        page: Number(page),
        limit: Number(limit),
      });
    });
  }

  // 🔥 ADD VIEW
  static async addView(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;
      const { id } = req.params;

      return await VideoGalleryService.addView(id, userId);
    });
  }

  static async deleteVideo(req, res) {
    return handleApiRequest(req, res, async () => {
      return await VideoGalleryService.deleteVideo(req.params.id);
    });
  }
}
