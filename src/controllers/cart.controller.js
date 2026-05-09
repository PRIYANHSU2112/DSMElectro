import { handleApiRequest, AppError } from "../utils/apiResponse.js";
import CartService from "../services/cartServices.js";
import logger from "../utils/logger.js";

export default class CartController {
  static async addToCart(req, res) {
    return handleApiRequest(req, res, async () => {
      const userId = req.user._id;
      const { items, variantId, quantity, comboId, affiliateCode } = req.body;

      let cartItems = [];

      if (items && Array.isArray(items)) {
        cartItems = items; // [{ variantId, quantity }, { comboId, quantity }]
      } else if (comboId) {
        cartItems = [{ comboId, quantity, affiliateCode }];
      } else if (variantId) {
        cartItems = [{ variantId, quantity, affiliateCode }];
      } else {
        throw new AppError("Invalid request payload", 400);
      }

      await CartService.addToCart(userId, cartItems);
      const cart = await CartService.getCart(userId);
      return [{ data: cart }, "Cart updated successfully"];
    });
  }

  static async getCart(req, res) {
    console.log(req.user);
    return handleApiRequest(req, res, async () => {
      const result = await CartService.getCart(req.user._id);
      return [{ data: result }, "Cart fetched"];
    });
  }

  static async updateCart(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await CartService.updateCartItem(
        req.user._id,
        req.params.id,
        req.body.quantity,
      );
      return [{ data: result }, "Cart updated"];
    });
  }

  static async removeItem(req, res) {
    return handleApiRequest(req, res, async () => {
      await CartService.removeItem(req.user._id, req.params.id);
      return [{}, "Item removed"];
    });
  }

  static async decrease(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await CartService.decreaseQuantity(
        req.user._id,
        req.params.id,
      );
      return [{ data: result }, "Quantity decreased"];
    });
  }

  static async clearCart(req, res) {
    return handleApiRequest(req, res, async () => {
      await CartService.clearCart(req.user._id);
      return [{}, "Cart cleared"];
    });
  }

  static async applyCoupon(req, res) {
    console.error("!!! CONTROLLER HIT: applyCoupon !!!");
    return handleApiRequest(req, res, async () => {
      const { code } = req.body;
      logger.info({ userId: req.user._id, code }, "Applying coupon");
      const result = await CartService.applyCoupon(req.user._id, code);
      const cart = await CartService.getCart(req.user._id);
      return [{ data: cart, ...result }, result.message];
    });
  }

  static async removeCoupon(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await CartService.removeCoupon(req.user._id);
      const cart = await CartService.getCart(req.user._id);
      return [{ data: cart, ...result }, result.message];
    });
  }
}
