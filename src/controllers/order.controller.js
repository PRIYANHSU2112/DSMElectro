import { handleApiRequest } from "../utils/apiResponse.js";
import OrderService from "../services/orderServices.js";

export default class OrderController {
  /**
   * POST /order
   *
   * Body:
   * {
   *   paymentMethod: "ONLINE" | "COD" | "WALLET",
   *   address: { _id } | { street, city, state, ... },
   *   shippingMode: "air" | "road",          // optional, default "road"
   *   walletOption: "COINS"|"BALANCE"|"REFERRAL",  // required when paymentMethod = "WALLET"
   *   refToken: "abc123"                      // optional — referral share token
   * }
   */
  static async createOrder(req, res) {
    return handleApiRequest(req, res, async () => {
      const {
        paymentMethod,
        address,
        shippingMode = "road",
        walletOption = null,
        refToken = null,
        affiliateCode = null, 
      } = req.body;

      const result = await OrderService.createOrder(
        req.user._id,
        paymentMethod,
        address,
        shippingMode,
        walletOption,
        refToken,
      );

      return [{ data: result }, "Order created", 201];
    });
  }

  static async verifyPayment(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await OrderService.verifyPayment(req.body);
      return [{ data: result }, "Payment verified"];
    });
  }

  static async getOrders(req, res) {
    return handleApiRequest(req, res, async () => {
      const { page = 1, limit = 10, status } = req.query;
      const data = await OrderService.getOrders(req.user._id, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
      });
      return [{ data }, "Orders fetched"];
    });
  }

  static async getOrderById(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await OrderService.getOrderById(req.params.id);
      return [{ data }, "Order fetched"];
    });
  }

  static async cancelOrder(req, res) {
    return handleApiRequest(req, res, async () => {
      const { reason } = req.body;
      const data = await OrderService.cancelOrder(req.params.id, req.user._id, reason);
      return [{ data }, "Order cancelled successfully"];
    });
  }

  static async updateStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await OrderService.updateStatus(
        req.params.id,
        req.body.status,
      );
      return [{ data }, "Status updated"];
    });
  }

  static async requestReturn(req, res) {
    return handleApiRequest(req, res, async () => {
      const { reason } = req.body;
      const media = req.files?.media?.map(f => f.location) || [];
      const data = await OrderService.requestReturn(req.params.id, req.user._id, reason, media);
      return [{ data }, "Return requested successfully", 200];
    });
  }

  static async updateReturnStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const { status, adminReason } = req.body;
      const data = await OrderService.updateReturnStatus(req.params.id, status, adminReason);
      return [{ data }, "Return status updated successfully", 200];
    });
  }
}
