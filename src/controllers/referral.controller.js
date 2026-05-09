import { handleApiRequest, AppError } from "../utils/apiResponse.js";
import ReferralService from "../services/referral.service.js";

export default class ReferralController {
  // GET /referral/link?productId=xxx  OR  ?comboId=xxx
  static async getLink(req, res) {
    return handleApiRequest(req, res, async () => {
      const { productId, comboId } = req.query;
      if (!productId && !comboId) throw new AppError("productId or comboId required", 400);

      const result = await ReferralService.getOrCreateLink(req.user._id, {
        productId,
        comboId,
      });
      return [{ data: result }, "Referral link generated"];
    });
  }

  // GET /referral/my  — links created by the current user + stats
  static async getMyReferrals(req, res) {
    return handleApiRequest(req, res, async () => {
      const data = await ReferralService.getMyReferrals(req.user._id);
      return [{ data }, "Your referral links"];
    });
  }
}