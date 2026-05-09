import BulkInquiryService from "../services/bulkInquiryServices.js";

export default class BulkInquiryController {
  // CREATE
  static async createInquiry(req, res) {
    try {
      const result = await BulkInquiryService.createInquiry(
        req.user._id,
        req.body
      );

      res.status(201).json({
        success: true,
        message: "Inquiry submitted successfully",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // USER
  static async getMyInquiry(req, res) {
    try {
      const result = await BulkInquiryService.getUserInquiries(
        req.user._id,
        req.query
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ADMIN
  static async getAll(req, res) {
    try {
      const result = await BulkInquiryService.getAllInquiries(req.query);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // UPDATE STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const result = await BulkInquiryService.updateStatus(id, status);

      res.json({
        success: true,
        message: "Status updated",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}