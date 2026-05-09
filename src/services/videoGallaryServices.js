// services/videoGallery.service.js
import VideoGallery from "../model/videoGallery.model.js";

export default class VideoGalleryService {
  static async createVideo(data) {
    const video = await VideoGallery.create(data);
    return video.toObject();
  }

  static async getVideos({ page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      VideoGallery.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      VideoGallery.countDocuments(),
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

  // 🔥 UNIQUE VIEW LOGIC
  static async addView(videoId, userId) {
    const video = await VideoGallery.findById(videoId);

    if (!video) throw new Error("Video not found");

    // check if already viewed
    if (!video.viewedBy.includes(userId)) {
      video.views += 1;
      video.viewedBy.push(userId);
      await video.save();
    }

    return {
      views: video.views,
    };
  }

  static async deleteVideo(id) {
    return await VideoGallery.findByIdAndDelete(id);
  }
}
