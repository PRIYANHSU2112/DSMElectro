import express from "express";
import ProjectController from "../controllers/project.controller.js";
import ProjectRatingController from "../controllers/projectRating.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

const projectUpload = ObjectStorageService.s3Uploader().fields([
    { name: "icon", maxCount: 1 },
    { name: "banner", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "video", maxCount: 1 },
]);

// ─── ADMIN: PROJECT CRUD ───────────────────────────────────────────────────
router.post("/create/project", authUser, adminMiddleware, projectUpload, ProjectController.createProject);
router.put("/project/:id", authUser, adminMiddleware, projectUpload, ProjectController.updateProject);
router.delete("/project/:id", authUser, adminMiddleware, ProjectController.deleteProject);
router.patch("/project/:id/status", authUser, adminMiddleware, ProjectController.toggleProjectStatus);

// ─── PUBLIC: PROJECT FETCH ─────────────────────────────────────────────────
// ?sort=newest|price_asc|price_desc|rating|popular|downloads
// ?search= ?category= ?subCategory= ?minPrice= ?maxPrice= ?page= ?limit=
router.get("/projects", authUser, ProjectController.getAllProjects);
router.get("/project/:id", authUser, ProjectController.getProjectById);
router.get("/projects/category/:categoryId", authUser, ProjectController.getProjectsByCategory);
router.get("/projects/subcategory/:subCategoryId", authUser, ProjectController.getProjectsBySubCategory);

// ─── USER ACTIONS ──────────────────────────────────────────────────────────
router.post("/project/:id/download", authUser, ProjectController.incrementDownloads);

// ─── RATINGS (USER) ────────────────────────────────────────────────────────
router.post("/project/:projectId/rating", authUser, ProjectRatingController.upsertRating);
router.delete("/project/:projectId/rating", authUser, ProjectRatingController.deleteMyRating);
router.get("/project/:projectId/rating/me", authUser, ProjectRatingController.getMyRating);
router.get("/project/:projectId/ratings", authUser, ProjectRatingController.getProjectRatings);

// ─── RATINGS (ADMIN) ───────────────────────────────────────────────────────
router.get("/admin/ratings", authUser, adminMiddleware, ProjectRatingController.getAllRatings);
router.delete("/admin/rating/:ratingId", authUser, adminMiddleware, ProjectRatingController.adminDeleteRating);

export default router;