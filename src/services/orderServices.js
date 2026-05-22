import mongoose from "mongoose";
import crypto from "crypto";
import orderModel from "../model/order.model.js";
import cartModel from "../model/cart.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import transactionModel from "../model/transaction.model.js";
import addressModel from "../model/address.model.js";
import redisClient from "../config/redis.js";
import { razorpay } from "../config/razorpay.js";
import { AppError } from "../utils/apiResponse.js";
import WalletService from "../services/wallteServices.js";
import ReferralService from "../services/referralServices.js";
import walletTransactionModel from "../model/walletTransaction.model.js";
import { applyFreeDelivery } from "../utils/shippingHelper.js"; // ← ADDED
import AffiliateService from "../services/affiliateServices.js";
import CouponService from "../services/couponServices.js";
import couponModel from "../model/coupon.model.js";
import { calculateCouponDiscount } from "../utils/couponCalculator.js";
import InvoiceService from "./invoiceServices.js";
import NotificationService from "./notificationServices.js";

/**
 * walletOption (when paymentMethod === "WALLET"):
 *   "COINS"    — deduct user's coin-balance (converted to Rs); remainder paid ONLINE
 *   "BALANCE"  — pay fully from main wallet balance; error if insufficient
 *   "REFERRAL" — use referral balance first; remainder paid ONLINE
 */

export default class OrderService {
  // ─── CREATE ORDER ──────────────────────────────────────────────────────────
  static async createOrder(
    userId,
    paymentMethod,
    addressInput,
    shippingMode = "road",
    walletOption = null,
    refToken = null,
    affiliateCode = null, // fallback
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── 1. Get cart ─────────────────────────────────────────
      const cart = await cartModel.findOne({ userId }).session(session);
      if (!cart || !cart.items.length) {
        throw new AppError("Cart is empty", 400);
      }
      console.log("cart",cart);

      const orderProducts = [];
      let total = 0;

      // ── 2. Build order items ────────────────────────────────
      for (const cartItem of cart.items) {
        //  Resolve affiliate per item
        const itemAffiliate = cartItem.affiliateCode || affiliateCode || null;

        // ── COMBO ──
        if (cartItem.comboId) {
          const combo = await comboModel
            .findById(cartItem.comboId)
            .session(session);
          if (!combo) throw new AppError("Combo not found", 404);

          orderProducts.push({
            comboId: combo._id,
            itemType: "combo",
            price: combo.comboPrice,
            quantity: cartItem.quantity,
            affiliateCode: itemAffiliate, // 🟢
          });

          total += combo.comboPrice * cartItem.quantity;
        }

        // ── VARIANT ──
        else {
          const variant = await variantModel
            .findById(cartItem.variantId)
            .session(session);
          if (!variant) throw new AppError("Variant not found", 404);

          console.log("Variant",variant);

          const finalPrice = variant.finalPrice || variant.mrp;

          orderProducts.push({
            productId: variant.productId,
            variantId: variant._id,
            itemType: "variant",
            price: finalPrice,
            quantity: cartItem.quantity,
            affiliateCode: itemAffiliate, 
          });

          total += finalPrice * cartItem.quantity;
        }
      }

      // ── 3. Shipping ─────────────────────────────────────────
      const shippingCharge = shippingMode === "air" ? 100 : 50; // your logic here modify according to function

      // ── 3.5 Coupon ──────────────────────────────────────────
      let couponCode = cart.appliedCoupon || null;
      let couponDiscount = 0;

      if (couponCode) {
        try {
          const { discountAmount } = await CouponService.validateAndGetCoupon(
            couponCode,
            userId,
            total,
          );
          couponDiscount = discountAmount;
        } catch (couponErr) {
          console.error("Coupon validation failed during order creation:", couponErr.message);
          // If coupon validation fails, we proceed without the coupon
          couponCode = null;
          couponDiscount = 0;
        }
      }

      const grandTotal = total + shippingCharge - couponDiscount;

      // ── 4. Resolve referral (unchanged) ─────────────────────
      let referral = null;
      if (refToken) {
        referral = await ReferralService.resolveToken(refToken);
      }

      // ── 5. Create order ─────────────────────────────────────
      const order = await orderModel.create(
        [
          {
            customerId: userId,
            product: orderProducts,
            orderTotal: grandTotal,
            shippingCharge,
            shippingMode,
            paymentMethod,
            paymentStatus: "UNPAID",
            referralToken: refToken ?? null,
            referrerId: referral?.referrerId ?? null,
            address: addressInput._id || addressInput,
            couponCode,
            couponDiscount,

            // fallback affiliate (optional)
            affiliateCode: affiliateCode ?? null,
          },
        ],
        { session },
      );

      const createdOrder = order[0];

      // ── 6. COD / WALLET immediate flow ──────────────────────
      const isCOD = paymentMethod === "COD";
      const isWallet = paymentMethod === "WALLET";

      if (isCOD || isWallet) {
        createdOrder.paymentStatus = "PAID";
        createdOrder.status = "ORDERED";

        await createdOrder.save({ session });

        // 🟢 MULTI-AFFILIATE COMMISSION
        for (const item of orderProducts) {
          const affCode = item.affiliateCode || affiliateCode;

          if (!affCode) continue;

          const itemAmount = item.price * item.quantity;

          await AffiliateService.recordCommission({
            affiliateCode: affCode,
            orderId: createdOrder._id,
            buyerId: userId,
            orderAmount: itemAmount,
            itemType: item.itemType,
            itemId: item.itemType === "combo" ? item.comboId : item.variantId,
          });
        }

        // 🟢 RECORD COUPON USAGE
        if (createdOrder.couponCode) {
          const coupon = await couponModel.findOne({
            code: createdOrder.couponCode,
          });
          if (coupon) {
            await CouponService.recordUsage(
              coupon._id,
              userId,
              createdOrder._id,
              createdOrder.couponDiscount,
            );
          }
        }

        // ── Deduct stock ──
        const stockDeductions = orderProducts.map((p) => ({
          type: p.itemType,
          id: p.itemType === "combo" ? p.comboId : p.variantId,
          qty: p.quantity,
        }));

        await OrderService._deductStock(stockDeductions, session);

        // ── Clear cart ──
        // await cartModel.deleteOne({ userId }).session(session);

        // 🟢 GENERATE INVOICE (Background)
        // InvoiceService.generateInvoice(createdOrder._id).catch(err => console.error("Auto-invoice failed:", err));
      }

      await session.commitTransaction();
      session.endSession();

      await OrderService._clearOrderCache(userId);

      return createdOrder;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  // ─── VERIFY PAYMENT (Razorpay callback) ───────────────────────────────────
  static async verifyPayment(data) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderId,
      } = data;

      const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      // if (expected !== razorpay_signature) {
      //   throw new AppError("Invalid payment signature", 400);
      // }

      const transaction = await transactionModel
        .findOne({ orderId, razorpayOrderId: razorpay_order_id })
        .session(session);

      // if (!transaction) throw new AppError("Transaction not found", 404);

      const order = await orderModel.findById(orderId).session(session);
      if (!order) throw new AppError("Order not found", 404);

      // update transaction
      if (transaction) {
        transaction.status = "SUCCESS";
        transaction.razorpayPaymentId = razorpay_payment_id;
        transaction.razorpaySignature = razorpay_signature;
        await transaction.save({ session });
      }

      // update order
      order.paymentStatus = "PAID";
      order.status = "ORDERED";
      order.transactionId = transaction?._id ?? null;
      await order.save({ session });

      // deduct stock
      const stockDeductions = order.product.map((p) => ({
        type: p.itemType,
        id: p.itemType === "combo" ? p.comboId : p.variantId,
        qty: p.quantity,
      }));

      await OrderService._deductStock(stockDeductions, session);

      // clear cart
      // await cartModel.deleteOne({ userId: order.customerId }).session(session);
// 
      // coins
      const totalCoins = await OrderService._calculateOrderCoins(order.product);

      if (totalCoins > 0) {
        await WalletService.creditCoins(
          order.customerId,
          totalCoins,
          order._id,
          session,
        );
      }

      // referral (unchanged)
      if (order.referrerId && order.referralToken) {
        const referral = await ReferralService.resolveToken(
          order.referralToken,
        );

        if (referral && referral.commissionPercent > 0) {
          const commissionAmount = parseFloat(
            ((order.orderTotal * referral.commissionPercent) / 100).toFixed(2),
          );

          await WalletService.creditReferral(
            referral.referrerId,
            commissionAmount,
            order._id,
            order.customerId,
            session,
          );

          await ReferralService.recordUse(referral._id, {
            buyerId: order.customerId,
            orderId: order._id,
            orderAmount: order.orderTotal,
            commissionPercent: referral.commissionPercent,
            commissionAmount,
          });
        }
      }

      // 🟢 RECORD COUPON USAGE
      if (order.couponCode) {
        const coupon = await couponModel.findOne({ code: order.couponCode });
        if (coupon) {
          await CouponService.recordUsage(
            coupon._id,
            order.customerId,
            order._id,
            order.couponDiscount,
          );
        }
      }
      // 🟢 GENERATE INVOICE (Background)
      InvoiceService.generateInvoice(order._id).catch(err => console.error("Auto-invoice failed:", err));

      // 🟢 MULTI-AFFILIATE COMMISSION (FINAL)
      for (const item of order.product) {
        const affCode = item.affiliateCode || order.affiliateCode;

        if (!affCode) continue;

        const itemAmount = item.price * item.quantity;

        await AffiliateService.recordCommission({
          affiliateCode: affCode,
          orderId: order._id,
          buyerId: order.customerId,
          orderAmount: itemAmount,
          itemType: item.itemType,
          itemId: item.itemType === "combo" ? item.comboId : item.variantId,
        });
      }

      await session.commitTransaction();
      session.endSession();

      await OrderService._clearOrderCache(order.customerId);

      const populatedOrder = await OrderService._populateOrder(order._id);

      return { order: populatedOrder, transaction };
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw err;
    }
  }

  
  // ─── GET ORDERS ───────────────────────────────────────────────────────────
  static async getOrders(userId, { page = 1, limit = 10, status = null } = {}) {
    const cacheKey = `orders:${userId}:${page}:${limit}:${status || "all"}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Redis error in getOrders:", err.message);
    }

    const query = { customerId: userId };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [orders, totalOrders] = await Promise.all([
      orderModel
        .find(query)
        .populate("product.productId")
        .populate("product.variantId")
        .populate("product.comboId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      orderModel.countDocuments(query),
    ]);

    const result = {
      orders,
      pagination: {
        totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
        currentPage: page,
        limit,
      },
    };

    try {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    } catch (err) {
      console.error("Redis set error in getOrders:", err.message);
    }

    return result;
  }


  static async getOrderById(orderId) {
    const order = await orderModel.findById(orderId)
    if (!order) throw new AppError("Order not found", 404);
    return order;
  }

  // ─── ADMIN STATUS UPDATE ──────────────────────────────────────────────────
  static async updateStatus(orderId, status) {
    const order = await orderModel.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);

    order.status = status;
    if (status === "DELIVERED") order.deliveredDate = new Date();

    await order.save();
    await OrderService._clearOrderCache(order.customerId);

    // Send push & in-app status update notification to user asynchronously
    NotificationService.notifyOrderStatusUpdate(order, status).catch((err) =>
      console.error("[OrderService] Failed to send status update notification:", err.message)
    );

    return order;
  }

  // ─── CANCEL ORDER ─────────────────────────────────────────────────────────
  static async cancelOrder(orderId, userId, reason = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await orderModel
        .findOne({ _id: orderId, customerId: userId })
        .session(session);
      if (!order) throw new AppError("Order not found", 404);

      const nonCancellable = ["SHIPPED", "ARRIVING", "DELIVERED", "CANCELLED"];
      if (nonCancellable.includes(order.status)) {
        throw new AppError(`Cannot cancel order in ${order.status} state`, 400);
      }

      order.status = "CANCELLED";
      order.cancellationReason = reason;

      // ── Refund to wallet if order was PAID ──
      if (order.paymentStatus === "PAID") {
        const refundAmount = order.orderTotal;

        // Credit refund to user's wallet balance
        const wallet = await WalletService._getOrCreate(userId, session);
        wallet.balance += refundAmount;
        await wallet.save({ session });

        // Log wallet transaction
        await WalletService._log(
          {
            userId,
            type: "REFUND",
            bucket: "balance",
            amount: refundAmount,
            credit: true,
            orderId: order._id,
            description: `Refund of ₹${refundAmount} for cancelled order #${order._id}`,
            balanceAfter: wallet.balance,
          },
          session,
        );

        // Create refund transaction record
        await transactionModel.create(
          [
            {
              orderId: order._id,
              customerId: userId,
              amount: refundAmount,
              currency: "INR",
              paymentMethod: order.paymentMethod,
              status: "REFUNDED",
              walletType: "CREDIT",
              walletPurpose: "REFUND",
            },
          ],
          { session },
        );

        order.paymentStatus = "FAILED"; // Mark as refunded
      }

      await order.save({ session });

      // Restock items
      const restockData = order.product.map((p) => ({
        type: p.itemType,
        id: p.itemType === "combo" ? p.comboId : p.variantId,
        qty: p.quantity,
      }));

      await OrderService._restockItems(restockData, session);

      await session.commitTransaction();
      session.endSession();

      await OrderService._clearOrderCache(userId);

      // Send push & in-app cancellation notification to user asynchronously
      NotificationService.notifyOrderStatusUpdate(order, "CANCELLED").catch((err) =>
        console.error("[OrderService] Failed to send order cancellation notification:", err.message)
      );

      // 🟢 Generate CANCELLATION invoice (background — after commit)
      InvoiceService.generateInvoice(order._id, "CANCELLATION")
        .then(async (invoice) => {
          if (invoice?.pdfUrl) {
            await orderModel.findByIdAndUpdate(order._id, {
              cancellationInvoiceUrl: invoice.pdfUrl,
            });
          }
        })
        .catch((err) => console.error("Cancellation invoice failed:", err));

      return order;
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw err;
    }
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  /**
   * Deduct stock for an array of { type, id, qty } entries.
   * Supports both variant and combo.
   */

  
  static async _deductStock(deductions, session) {
    for (const d of deductions) {
      if (d.type === "combo") {
        const updated = await comboModel.findOneAndUpdate(
          { _id: d.id, stock: { $gte: d.qty } },
          { $inc: { stock: -d.qty } },
          { session, new: true },
        );
        if (!updated)
          throw new AppError("Combo stock insufficient at checkout", 400);
      } else {
        const updated = await variantModel.findOneAndUpdate(
          { _id: d.id, stock: { $gte: d.qty } },
          { $inc: { stock: -d.qty } },
          { session, new: true },
        );
        if (!updated)
          throw new AppError("Variant stock insufficient at checkout", 400);
      }
    }
  }

  /**
   * Restock items after cancellation
   */
  static async _restockItems(restockData, session) {
    for (const d of restockData) {
      if (d.type === "combo") {
        await comboModel.findByIdAndUpdate(
          d.id,
          { $inc: { stock: d.qty } },
          { session },
        );
      } else {
        await variantModel.findByIdAndUpdate(
          d.id,
          { $inc: { stock: d.qty } },
          { session },
        );
      }
    }
  }

  /**
   * Sum up coins to award from order items.
   * Requires populated variant/combo docs — we re-fetch lean here.
   */
  static async _calculateOrderCoins(orderProducts) {
    let total = 0;
    for (const p of orderProducts) {
      if (p.itemType === "combo") {
        const combo = await comboModel
          .findById(p.comboId)
          .select("coinsReward")
          .lean();
        total += (combo?.coinsReward ?? 0) * p.quantity;
      } else {
        const variant = await variantModel
          .findById(p.variantId)
          .select("coinsReward")
          .lean();
        total += (variant?.coinsReward ?? 0) * p.quantity;
      }
    }
    return total;
  }

  /**
   * Populate a fully resolved order for the API response.
   */
  static async _populateOrder(orderId) {
    const order = await orderModel
      .findById(orderId)
      .populate({
        path: "address",
        select: "street city state country pincode",
        populate: [
          { path: "city", select: "name" },
          { path: "state", select: "name" },
          { path: "country", select: "name" },
          { path: "pincode", select: "code" },
        ],
      })
      .populate("product.productId", "name icon")
      .populate("product.variantId", "mrp finalPrice discount size")
      .populate("product.comboId", "name icon comboPrice")
      .lean();

    // flatten address
    const addr = order?.address ?? {};
    order.address = {
      street: addr.street ?? null,
      city: addr.city?.name ?? null,
      state: addr.state?.name ?? null,
      country: addr.country?.name ?? null,
      pincode: addr.pincode?.code ?? null,
    };

    return order;
  }

  /**
   * Wallet transactions created before the order _id existed get null orderId.
   * This patches them after commit.
   */
  static async _patchOrderId(userId, orderId, session) {
    await walletTransactionModel.updateMany(
      {
        userId,
        orderId: null,
        createdAt: { $gte: new Date(Date.now() - 60_000) },
      },
      { $set: { orderId } },
      { session },
    );
  }

  static async _clearOrderCache(userId) {
    try {
      const keys = await redisClient.keys(`orders:${userId}:*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (err) {
      console.error("Redis clear error:", err.message);
    }
  }

  // ─── RETURN ORDER ─────────────────────────────────────────────────────────
  static async requestReturn(orderId, userId, reason, media) {
    const order = await orderModel.findOne({ _id: orderId, customerId: userId });
    
    if (!order) throw new AppError("Order not found", 404);
    if (order.status !== "DELIVERED") throw new AppError("Order must be delivered to request a return", 400);

    const returnStatuses = ["RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "RETURNED"];
    if (returnStatuses.includes(order.status)) throw new AppError("Return already requested", 400);

    let maxReturnDays = 0;
    const productIds = order.product.map(p => p.productId).filter(Boolean);
    if (productIds.length > 0) {
      const productModel = (await import("../model/product.model.js")).default;
      const products = await productModel.find({ _id: { $in: productIds } }).lean();
      products.forEach(p => {
         if (p.returnInDays > maxReturnDays) maxReturnDays = p.returnInDays;
      });
    }

    if (maxReturnDays === 0) {
      throw new AppError("Items in this order are non-returnable", 400);
    }

    if (!order.deliveredDate) {
      throw new AppError("Delivered date is missing", 400);
    }

    const diffTime = Math.abs(new Date() - order.deliveredDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > maxReturnDays) {
      throw new AppError(`Return window of ${maxReturnDays} days has expired`, 400);
    }

    order.status = "RETURN_REQUESTED";
    order.returnReason = reason;
    order.returnMedia = media || [];

    await order.save();
    await OrderService._clearOrderCache(userId);

    return order;
  }

  // ─── UPDATE RETURN STATUS (Admin) ─────────────────────────────────────────
  static async updateReturnStatus(orderId, status, adminReason = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    let refundAmount = 0;

    try {
      const order = await orderModel.findById(orderId).session(session);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const returnStatuses = ["RETURN_REQUESTED", "RETURN_APPROVED"];
      if (!returnStatuses.includes(order.status)) {
        throw new AppError("Valid return request not found or already processed", 400);
      }

      const validStatuses = ["RETURN_APPROVED", "RETURN_REJECTED", "RETURNED"];
      if (!validStatuses.includes(status)) {
        throw new AppError("Invalid return status. Use RETURN_APPROVED, RETURN_REJECTED, or RETURNED.", 400);
      }

      order.status = status;

      if (status === "RETURN_REJECTED") {
        if (!adminReason) throw new AppError("Reason is required for rejection", 400);
        order.returnAdminReason = adminReason;
      } else if (status === "RETURNED") {
        // Trigger Refund
        refundAmount = order.orderTotal;

        const wallet = await WalletService._getOrCreate(order.customerId, session);
        wallet.balance += refundAmount;
        await wallet.save({ session });

        await WalletService._log({
          userId: order.customerId,
          type: "REFUND",
          bucket: "balance",
          amount: refundAmount,
          credit: true,
          orderId: order._id,
          description: `Refund of ₹${refundAmount} for returned order #${order._id}`,
          balanceAfter: wallet.balance,
        }, session);

        await transactionModel.create([{
          orderId: order._id,
          customerId: order.customerId,
          amount: refundAmount,
          currency: "INR",
          paymentMethod: "WALLET",
          status: "REFUNDED",
          walletType: "CREDIT",
          walletPurpose: "REFUND"
        }], { session });

        const restockData = order.product.map((p) => ({
          type: p.itemType,
          id: p.itemType === "combo" ? p.comboId : p.variantId,
          qty: p.quantity,
        }));
        await OrderService._restockItems(restockData, session);
      }

      await order.save({ session });
      await session.commitTransaction();
      session.endSession();

      await OrderService._clearOrderCache(order.customerId);

      const NotificationService = (await import("./notificationServices.js")).default;
      if (status === "RETURN_APPROVED") {
        NotificationService.sendToUser(order.customerId, {
          title: "Return Approved ✅",
          message: `Your return request for order #${order._id} is approved. Product will be picked up within 5 days.`,
          type: "RETURN_APPROVED",
          orderId: order._id
        });
      } else if (status === "RETURN_REJECTED") {
        NotificationService.sendToUser(order.customerId, {
          title: "Return Rejected ❌",
          message: `Your return request for order #${order._id} was rejected. Reason: ${adminReason}`,
          type: "RETURN_REJECTED",
          orderId: order._id
        });
      } else if (status === "RETURNED") {
        NotificationService.sendToUser(order.customerId, {
          title: "Refund Processed 💰",
          message: `Your returned item is received. ₹${refundAmount} has been added to your wallet!`,
          type: "REFUND_PROCESSED",
          orderId: order._id
        });
      }

      return order;
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }
}
