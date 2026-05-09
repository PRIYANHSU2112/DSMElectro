import { ValidationError, handleApiRequest } from "../utils/apiResponse.js";
import BuyNowService from "../services/buyNowSerices.js";

/**
 * BuyNowController
 *
 * POST /buy-now
 * Body:
 * {
 *   itemType:      "variant" | "combo"          (default: "variant")
 *   itemId:        ObjectId  — variantId OR comboId
 *   quantity:      number    (default: 1)
 *   paymentMethod: "COD" | "ONLINE" | "WALLET"
 *   address:       { _id } for existing  OR  full address object
 *   shippingMode:  "air" | "road"               (default: "road")
 *   walletOption:  "COINS" | "BALANCE" | "REFERRAL"  (required if paymentMethod = "WALLET")
 *   refToken:      string   (optional referral token)
 *   affiliateCode: string   (optional)
 * }
 *
 * POST /buy-now/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
 */
export default class BuyNowController {
  static async createBuyNowOrder(req, res) {
    return handleApiRequest(req, res, async () => {
      const {
        itemType = "variant",
        itemId,
        // legacy support — if caller still passes variantId / comboId
        variantId,
        comboId,
        quantity = 1,
        paymentMethod,
        address,
        shippingMode = "road",
        walletOption = null,
        refToken = null,
        affiliateCode = null,
      } = req.body;

      // Resolve itemId — prefer explicit itemId, fall back to variantId / comboId
      const resolvedItemId =
        itemId ?? (itemType === "combo" ? comboId : variantId);
      const resolvedItemType = itemId
        ? itemType
        : comboId
          ? "combo"
          : "variant";

      if (!resolvedItemId)
        throw new ValidationError(
          "itemId (or variantId / comboId) is required",
        );
      if (!address) throw new ValidationError("address is required");
      if (!["COD", "ONLINE", "WALLET"].includes(paymentMethod)) {
        throw new ValidationError(
          "paymentMethod must be COD, ONLINE, or WALLET",
        );
      }
      if (
        paymentMethod === "WALLET" &&
        !["COINS", "BALANCE", "REFERRAL"].includes(walletOption)
      ) {
        throw new ValidationError(
          "walletOption must be COINS, BALANCE, or REFERRAL when paymentMethod is WALLET",
        );
      }

      const result = await BuyNowService.createBuyNowOrder(
        req.user._id,
        resolvedItemType,
        resolvedItemId,
        quantity,
        paymentMethod,
        address,
        shippingMode,
        walletOption,
        refToken,
        affiliateCode,
      );

      return [{ data: result }, "Order created successfully", 201];
    });
  }

  static async verifyPayment(req, res) {
    return handleApiRequest(req, res, async () => {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderId,
      } = req.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !orderId
      ) {
        throw new ValidationError(
          "razorpay_order_id, razorpay_payment_id, razorpay_signature, and orderId are all required",
        );
      }

      const result = await BuyNowService.verifyPayment(req.body);
      return [{ data: result }, "Payment verified successfully", 200];
    });
  }
}
