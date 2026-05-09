import JobService from "../services/jobServiecs.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class JobController {
  // CREATE JOB (Admin)
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const job = await JobService.createJob(req.body);
      return [{ data: job }, "Job created successfully", 201];
    });
  }

  // GET ALL JOBS (Public/User)
  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await JobService.getAllJobs(req.query);
      return [{ data: result }, "Jobs fetched successfully"];
    });
  }

  // GET JOB BY ID (Public)
  static async getById(req, res) {
    return handleApiRequest(req, res, async () => {
      const job = await JobService.getJobById(req.params.id);
      return [{ data: job }, "Job fetched successfully"];
    });
  }

  // TOGGLE JOB STATUS (Admin)
  static async toggle(req, res) {
    return handleApiRequest(req, res, async () => {
      const job = await JobService.toggleJob(req.params.id);
      return [{ data: job }, "Job status updated"];
    });
  }

  // DELETE JOB (Admin)
  static async delete(req, res) {
    return handleApiRequest(req, res, async () => {
      await JobService.deleteJob(req.params.id);
      return [{}, "Job deleted successfully"];
    });
  }

  // APPLY FOR JOB (User)
  static async apply(req, res) {
    return handleApiRequest(req, res, async () => {
      const resumeFile = req.files?.resume?.[0];

      if (!resumeFile) {
        throw new Error("Resume is required");
      }

      const data = {
        ...req.body,
        resume: resumeFile.location,
      };

      const application = await JobService.applyJob(data);
      return [{ data: application }, "Application submitted successfully", 201];
    });
  }

  // GET APPLICATIONS (Admin)
  static async getApplications(req, res) {
    return handleApiRequest(req, res, async () => {
      const jobId = req.params.jobId === "all" ? null : req.params.jobId;
      const result = await JobService.getApplications(jobId, req.query);
      return [{ data: result }, "Applications fetched successfully"];
    });
  }

  // UPDATE APPLICATION STATUS (Admin)
  static async updateAppStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;
      const { status } = req.body;
      const app = await JobService.updateApplicationStatus(id, status);
      return [{ data: app }, "Application status updated"];
    });
  }
}