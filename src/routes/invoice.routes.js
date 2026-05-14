import express from "express";
import InvoiceController from "../controllers/invoice.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/invoice/generate/:orderId", authUser, adminMiddleware, InvoiceController.generateInvoice);
router.get("/invoice/order/:orderId", authUser, InvoiceController.getInvoiceByOrder);
router.get("/invoice/all", authUser, adminMiddleware, InvoiceController.getAllInvoices);
router.patch("/invoice/:id", authUser, adminMiddleware, InvoiceController.updateInvoice);

export default router;
