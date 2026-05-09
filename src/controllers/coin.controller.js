// controllers/coin.controller.js

import { handleApiRequest, AppError } from "../utils/apiResponse.js";
import CoinService from "../services/coinServices.js";

export default class CoinController {
  // ✅ Get current config
  static async getConfig(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await CoinService.getConfig();
      return [{ data }, "Coin config fetched"];
    });
  }

  // ✅ Update config (ADMIN)
  static async updateConfig(req, res) {
    return handleApiRequest(req, res, async () => {
      const { rupee, coins } = req.body;

      if (!rupee || !coins) {
        throw new AppError("Rupee and coins are required", 400);
      }

      const data = await CoinService.updateConfig({ rupee, coins });

      return [{ data }, "Coin config updated"];
    });
  }

  // ✅ Convert ₹ → Coins (for testing)
  static async convert(req, res) {
    return handleApiRequest(req, res, async () => {
      const { amount } = req.query;

      if (!amount) {
        throw new AppError("Amount is required", 400);
      }

      const coins = await CoinService.convertRupeeToCoins(Number(amount));

      return [{ data: { amount, coins } }, "Conversion success"];
    });
  }
}
