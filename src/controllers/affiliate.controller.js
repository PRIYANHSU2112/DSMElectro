import AffiliateService from "../services/affiliateServices.js";
import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerAffiliateSchema,
  withdrawalSchema,
  processWithdrawalSchema,
  commissionSchema,
  rejectSchema,
  createTierSchema,
  updateTierSchema,
} from "../validators/affiliateValidation.js";

export default class AffiliateController {
  //  OTP

  static async sendOtp(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = sendOtpSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      await AffiliateService.sendOtp(req.body.phone);
      return [{}, "OTP sent successfully", 200];
    });
  }

  static async verifyOtp(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = verifyOtpSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.verifyOtp(
        req.body.phone,
        req.body.otp,
      );
      return [{ data: result }, "OTP verified successfully", 200];
    });
  }

  //  REGISTRATION

  static async register(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = registerAffiliateSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.registerAffiliate(
        req.user._id,
        req.body,
        req.files,
      );
      return [
        { data: result },
        "Affiliate application submitted successfully",
        201,
      ];
    });
  }

  //  USER — PROFILE & DASHBOARD

  static async getMyProfile(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getMyProfile(req.user._id);
      return [{ data: result }, "Profile fetched"];
    });
  }

  static async getMyWallet(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getMyWallet(req.user._id);
      return [{ data: result }, "Wallet fetched"];
    });
  }

  static async getDashboard(req, res) {
    return handleApiRequest(req, res, async () => {
      const { days } = req.query;
      const result = await AffiliateService.getDashboard(req.user._id, {
        days: parseInt(days) || 7,
      });
      return [{ data: result }, "Dashboard fetched"];
    });
  }

  static async getMyCommissions(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getMyCommissions(
        req.user._id,
        req.query,
      );
      return [{ data: result }, "Commissions fetched"];
    });
  }

  //  USER — WITHDRAWALS

  static async requestWithdrawal(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = withdrawalSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.requestWithdrawal(
        req.user._id,
        req.body,
      );
      return [{ data: result }, "Withdrawal request submitted", 201];
    });
  }

  static async getMyWithdrawals(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getMyWithdrawals(
        req.user._id,
        req.query,
      );
      return [{ data: result }, "Withdrawal history fetched"];
    });
  }

  //  PUBLIC

  // called by frontend when someone visits a referral link
  static async trackClick(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.trackClick({
        affiliateCode: req.params.affiliateCode,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        itemType: req.query.type || null,
        itemId: req.query.itemId || null,
      });

      if (!result) {
        return [{}, "Invalid or inactive affiliate code", 400];
      }

      return [
        {
          affiliateCode: req.params.affiliateCode,
          itemType: req.query.type || null,
          itemId: req.query.itemId || null,
        },
        "Click tracked successfully",
        200,
      ];
    });
  }

  // validate a referral code and return affiliate name
  static async resolveAffiliate(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.resolveAffiliateCode(
        req.params.affiliateCode,
      );
      return [{ data: result }, "Referral code is valid"];
    });
  }

  //  ADMIN

  static async getAdminStats(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getAdminStats();
      return [{ data: result }, "Admin stats fetched"];
    });
  }

  static async getAdminDashboardOverview(req, res) {
    return handleApiRequest(req, res, async () => {
      console.log("[DEBUG] getAdminDashboardOverview called, URL:", req.originalUrl);
      const result = await AffiliateService.getAdminDashboardOverview(req.query);
      return [{ data: result }, "Admin dashboard overview fetched"];
    });
  }

  static async getAllAffiliates(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getAllAffiliates(req.query);
      return [{ data: result }, "Affiliates fetched"];
    });
  }

  static async getAffiliateById(req, res) {
    return handleApiRequest(req, res, async () => {
      console.log("[DEBUG] getAffiliateById called, URL:", req.originalUrl, "id:", req.params.id);
      const result = await AffiliateService.getAffiliateById(req.params.id);
      return [{ data: result }, "Affiliate fetched"];
    });
  }

  static async approveAffiliate(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.approveAffiliate(req.params.id);
      return [{ data: result }, "Affiliate approved successfully"];
    });
  }

  static async rejectAffiliate(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = rejectSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.rejectAffiliate(
        req.params.id,
        req.body.reason,
      );
      return [{ data: result }, "Affiliate rejected"];
    });
  }

  static async setGlobalCommission(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = commissionSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.setGlobalCommission(
        req.body.commissionPercent,
      );
      return [
        { data: { commissionPercent: result } },
        "Global commission updated",
      ];
    });
  }

  static async setAffiliateCommission(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = commissionSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.setAffiliateCommission(
        req.params.id,
        req.body.commissionPercent,
      );
      return [{ data: result }, "Affiliate commission updated"];
    });
  }

  static async getAllWithdrawals(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getAllWithdrawals(req.query);
      return [{ data: result }, "Withdrawals fetched"];
    });
  }

  static async processWithdrawal(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = processWithdrawalSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.processWithdrawal(
        req.params.id,
        req.body,
      );
      return [{ data: result }, `Withdrawal ${req.body.action}d successfully`];
    });
  }

  // ── TIERS ──────────────────────────────────────────────────────────────────

  static async createTier(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = createTierSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.createTier(req.body);
      return [{ data: result }, "Tier created successfully", 201];
    });
  }

  static async updateTier(req, res) {
    return handleApiRequest(req, res, async () => {
      const { error } = updateTierSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const result = await AffiliateService.updateTier(req.params.id, req.body);
      return [{ data: result }, "Tier updated successfully"];
    });
  }

  static async getAllTiers(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getAllTiers();
      return [{ data: result }, "All tiers fetched"];
    });
  }

  static async getActiveTiers(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await AffiliateService.getActiveTiers();
      return [{ data: result }, "Active tiers fetched"];
    });
  }

  static async deleteTier(req, res) {
    return handleApiRequest(req, res, async () => {
      await AffiliateService.deleteTier(req.params.id);
      return [{}, "Tier deleted successfully"];
    });
  }

  // ── Referral Tracking Dashboard ────────────────────────────────────────────
  static async getReferralTrackingDashboard(req, res) {
    return handleApiRequest(req, res, async () => {
      const { days = 14, page = 1, limit = 10 } = req.query;
      const result = await AffiliateService.getReferralTrackingDashboard({
        days:  parseInt(days)  || 14,
        page:  parseInt(page)  || 1,
        limit: parseInt(limit) || 10,
      });
      return [{ data: result }, "Referral tracking dashboard fetched"];
    });
  }
}
