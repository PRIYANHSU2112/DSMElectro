import express from "express";
import BulkInquiryController from "../controllers/bulkInquiry.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// CREATE (logged-in only)
router.post("/bulk-inquiry", authUser, BulkInquiryController.createInquiry);

// USER
router.get("/bulk-inquiry/user", authUser, BulkInquiryController.getMyInquiry);

// ADMIN
router.get("/bulk-inquiry", authUser, adminMiddleware, BulkInquiryController.getAll);

router.put(
  "/bulk-inquiry/:id",
  authUser,
  adminMiddleware,
  BulkInquiryController.updateStatus
);

export default router;