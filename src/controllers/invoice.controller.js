import InvoiceService from "../services/invoiceServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";
import Invoice from "../model/invoice.model.js";

export default class InvoiceController {
  static async generateInvoice(req, res) {
    return handleApiRequest(req, res, async () => {
      const { orderId } = req.params;
      const { type } = req.query; // ORDER or CANCELLATION
      const invoice = await InvoiceService.generateInvoice(orderId, type);
      return [{ data: invoice }, "Invoice generated successfully"];
    });
  }

  static async getInvoiceByOrder(req, res) {
    return handleApiRequest(req, res, async () => {
      const { orderId } = req.params;
      const invoice = await Invoice.findOne({ orderId }).sort({ createdAt: -1 });
      return [{ data: invoice }, "Invoice fetched"];
    });
  }

  static async getAllInvoices(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        Invoice.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("customerId", "name email").populate("orderId", "_id status"),
        Invoice.countDocuments(),
      ]);

      return [{
        data,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        }
      }, "Invoices fetched"];
    });
  }

  static async updateInvoice(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;
      const invoice = await InvoiceService.updateInvoice(id, req.body);
      return [{ data: invoice }, "Invoice updated successfully"];
    });
  }
}
