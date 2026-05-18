import Job from "../model/job.model.js";
import JobApplication from "../model/jobApplication.model.js";
import redisClient from "../config/redis.js";
import mongoose from "mongoose";

export default class JobService {
  static async createJob(data) {
    const job = await Job.create(data);
    await JobService._clearJobCache();
    return job;
  }

  static async getAllJobs(query) {
    const {
      page = 1,
      limit = 10,
      search,
      jobType,
      workMode,
      country,
      state,
      city,
      sort = "newest"
    } = query;

    const cacheKey = `jobs:list:${JSON.stringify(query)}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis error:", err.message);
    }

    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    if (jobType) filter.jobType = jobType;
    if (workMode) filter.workMode = workMode;
    if (country) filter.country = country;
    if (state) filter.state = state;
    if (city) filter.city = city;

    const skip = (page - 1) * limit;

    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate("country", "name")
        .populate("state", "name")
        .populate("city", "name")
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Job.countDocuments(filter),
    ]);

    const result = {
      jobs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };

    try {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(result)); // 10 mins
    } catch (err) {
      console.error("Redis set error:", err.message);
    }

    return result;
  }

  static async toggleJob(id) {
    const job = await Job.findById(id);
    if (!job) throw new Error("Job not found");
    job.isActive = !job.isActive;
    await job.save();
    await JobService._clearJobCache(id);
    return job;
  }

  static async deleteJob(id) {
    const res = await Job.findByIdAndDelete(id);
    await JobService._clearJobCache(id);
    return res;
  }

  static async getJobById(id) {
    const cacheKey = `job:${id}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis error:", err.message);
    }

    const job = await Job.findById(id)
      .populate("country", "name")
      .populate("state", "name")
      .populate("city", "name")
      .lean();

    if (!job) throw new Error("Job not found");

    try {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(job));
    } catch (err) {
      console.error("Redis set error:", err.message);
    }

    return job;
  }

  static async applyJob(data) {
    return await JobApplication.create(data);
  }

  static async getApplications(jobId, query = {}) {
    const { page = 1, limit = 10 } = query;
    const filter = jobId ? { jobId } : {};
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      JobApplication.find(filter)
        .populate("jobId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      JobApplication.countDocuments(filter),
    ]);

    return {
      applications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async updateApplicationStatus(id, status) {
    return await JobApplication.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  }

  static async _clearJobCache(id = null) {
    try {
      const keys = await redisClient.keys("jobs:list:*");
      if (id) keys.push(`job:${id}`);

      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (err) {
      console.error("Redis clear error:", err.message);
    }
  }
}