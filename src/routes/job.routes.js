
import express from "express";
import JobController from "../controllers/job.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

// ================= ADMIN =================

// Create Job
router.post("/job", authUser, adminMiddleware, JobController.create);

// Delete Job
router.delete("/job/:id", authUser, adminMiddleware, JobController.delete);

// Enable / Disable Job (toggle)
router.patch("/job/:id/toggle", authUser, adminMiddleware, JobController.toggle);

// View Applications for a Job or all applications
// Use jobId = 'all' to get all applications
router.get("/applications/:jobId", authUser, adminMiddleware, JobController.getApplications);

// Update Application Status
router.patch("/application/:id/status", authUser, adminMiddleware, JobController.updateAppStatus);


// ================= USER/PUBLIC =================

// Get Jobs (search + latest + filters + pagination)
router.get("/jobs", JobController.getAll);

// Get Single Job
router.get("/job/:id", JobController.getById);

// Apply Job (WITH S3 UPLOAD)
router.post(
  "/apply",
  ObjectStorageService.s3Uploader().fields([
    { name: "resume", maxCount: 1 },
  ]),
  JobController.apply
);

export default router;