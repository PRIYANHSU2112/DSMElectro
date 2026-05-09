import CouponService from "../services/couponServices.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class CouponController {
  static async create(req, res) {
    return handleApiRequest(req, res, async () => {
      const coupon = await CouponService.createCoupon(req.body);
      return [coupon, "Coupon created successfully", 201];
    });
  }

  static async getAll(req, res) {
    return handleApiRequest(req, res, async () => {
      const coupons = await CouponService.getAllCoupons(req.query);
      return [coupons, "Coupons fetched successfully", 200];
    });
  }

  static async validate(req, res) {
    return handleApiRequest(req, res, async () => {
      const { code, cartTotal } = req.body;
      const userId = req.user.id;

      const result = await CouponService.validateAndGetCoupon(code, userId, cartTotal);
      return [result, "Coupon applied successfully", 200];
    });
  }

  static async update(req, res) {
    return handleApiRequest(req, res, async () => {
      const coupon = await CouponService.updateCoupon(req.params.id, req.body);
      return [coupon, "Coupon updated successfully", 200];
    });
  }

  static async delete(req, res) {
    return handleApiRequest(req, res, async () => {
      await CouponService.deleteCoupon(req.params.id);
      return [{}, "Coupon deleted successfully", 200];
    });
  }
}
