import { handleApiRequest, AppError } from "../utils/apiResponse.js";
import WalletService from "../services/wallteServices.js";

export default class WalletController {
  // GET /wallet  — current user's wallet
  static async getWallet(req, res) {
    return handleApiRequest(req, res, async () => {
      const wallet = await WalletService.getWallet(req.user._id);
      return [{ data: wallet }, "Wallet fetched"];
    });
  }

  // POST /wallet/topup  — { amount }
  static async topUp(req, res) {
    return handleApiRequest(req, res, async () => {
      const { amount } = req.body;
      if (!amount || amount <= 0) throw new AppError("Invalid amount", 400);

      // In production you'd create a Razorpay order here and verify
      // before crediting. For now we credit directly (e.g. after your
      // payment gatewayck calls this internally).
      const wallet = await WalletService.topUp(req.user._id, Number(amount));
      return [{ data: wallet }, `₹${amount} added to wallet`];
    });
  }

  // GET /wallet/transactions  — paginated history
  static async getTransactions(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await WalletService.getTransactions(req.user._id, req.query);
      return [{ data: result }, "Transactions fetched"];
    });
  }

  // POST /wallet/admin/adjust  — admin credit/debit any bucket
  // Body: { userId, bucket, amount, credit, description }
  static async adminAdjust(req, res) {
    return handleApiRequest(req, res, async () => {
      const { userId, bucket, amount, credit, description } = req.body;
      if (!userId) throw new AppError("userId required", 400);

      const wallet = await WalletService.adminAdjust(userId, {
        bucket,
        amount: Number(amount),
        credit: Boolean(credit),
        description,
      });
      return [{ data: wallet }, "Wallet adjusted"];
    });
  }
}