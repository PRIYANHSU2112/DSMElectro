import mongoose from "mongoose";
import crypto from "crypto";
import orderModel from "../model/order.model.js";
import variantModel from "../model/variant.model.js";
import comboModel from "../model/combo.model.js";
import productModel from "../model/product.model.js";
import transactionModel from "../model/transaction.model.js";
import addressModel from "../model/address.model.js";
import walletModel from "../model/wallet.model.js";
import redisClient from "../config/redis.js";
import { razorpay } from "../config/razorpay.js";
import { AppError } from "../utils/apiResponse.js";
import WalletService from "../services/wallteServices.js";
import ReferralService from "../services/referralServices.js";
import AffiliateService from "../services/affiliateServices.js";
import { applyFreeDelivery } from "../utils/shippingHelper.js";

/**
 * BuyNowService — single-item checkout (variant OR combo).
 *
 * Wallet flow (two-phase):
 *   Phase 1 — _previewWalletPayment()  : pure math, reads wallet, NO writes, NO orderId needed
 *   Phase 2 — _executeWalletPayment()  : actual deduction, called AFTER order is created with real orderId
 *
 * This avoids the duplicate-key crash caused by passing null orderId into
 * WalletService methods that call _getOrCreate internally.
 */
export default class BuyNowService {

  // ─── CREATE ORDER ──────────────────────────────────────────────────────────
  /**
   * @param {ObjectId}  userId
   * @param {string}    itemType       "variant" | "combo"
   * @param {ObjectId}  itemId         variantId OR comboId
   * @param {number}    quantity
   * @param {string}    paymentMethod  "COD" | "ONLINE" | "WALLET"
   * @param {object}    addressInput   { _id } for existing OR full address object
   * @param {string}    shippingMode   "air" | "road"
   * @param {string}    walletOption   "COINS" | "BALANCE" | "REFERRAL" (required when paymentMethod = "WALLET")
   * @param {string}    refToken       optional referral share token
   * @param {string}    affiliateCode  optional affiliate code
   */
  static async createBuyNowOrder(
    userId,
    itemType = "variant",
    itemId,
    quantity,
    paymentMethod,
    addressInput,
    shippingMode = "road",
    walletOption = null,
    refToken = null,
    affiliateCode = null,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── 1. Validate inputs ───────────────────────────────────────────────
      if (!["variant", "combo"].includes(itemType)) {
        throw new AppError("itemType must be 'variant' or 'combo'", 400);
      }
      if (!["air", "road"].includes(shippingMode)) {
        throw new AppError("shippingMode must be 'air' or 'road'", 400);
      }
      if (!["COD", "ONLINE", "WALLET"].includes(paymentMethod)) {
        throw new AppError("paymentMethod must be COD, ONLINE, or WALLET", 400);
      }
      if (
        paymentMethod === "WALLET" &&
        !["COINS", "BALANCE", "REFERRAL"].includes(walletOption)
      ) {
        throw new AppError(
          "walletOption must be COINS, BALANCE, or REFERRAL when paymentMethod is WALLET",
          400,
        );
      }

      const qty = parseInt(quantity) || 1;
      if (qty < 1) throw new AppError("Quantity must be at least 1", 400);

      // ── 2. Resolve address ───────────────────────────────────────────────
      let addressId;
      if (addressInput?._id) {
        const existing = await addressModel.findOne({
          _id: addressInput._id,
          userId,
        });
        if (!existing)
          throw new AppError("Address not found or does not belong to user", 404);
        addressId = existing._id;
      } else {
        const [newAddress] = await addressModel.create(
          [{ ...addressInput, userId }],
          { session },
        );
        addressId = newAddress._id;
      }

      // ── 3. Resolve item (variant OR combo) ───────────────────────────────
      let unitPrice, orderProduct, shippingCharge;

      if (itemType === "combo") {
        const combo = await comboModel
          .findOne({ _id: itemId, disable: { $ne: true } })
          .lean();
        if (!combo) throw new AppError("Combo not found or unavailable", 404);
        if ((combo.stock ?? 0) < qty)
          throw new AppError(`Only ${combo.stock} unit(s) available in stock`, 400);

        unitPrice      = combo.comboPrice;
        shippingCharge = combo?.minDeliveryCharge?.[shippingMode] ?? 0;

        orderProduct = {
          comboId:       combo._id,
          itemType:      "combo",
          price:         unitPrice,
          quantity:      qty,
          affiliateCode: affiliateCode ?? null,
        };
      } else {
        const variant = await variantModel
          .findOne({ _id: itemId, disable: false })
          .lean();
        if (!variant)
          throw new AppError("Product variant not found or unavailable", 404);
        if (variant.stock < qty)
          throw new AppError(`Only ${variant.stock} unit(s) available in stock`, 400);

        if (variant.finalPrice != null) {
          unitPrice = variant.finalPrice;
        } else if (variant.discount > 0) {
          unitPrice = variant.mrp - (variant.mrp * variant.discount) / 100;
        } else {
          unitPrice = variant.mrp;
        }

        const product = await productModel
          .findById(variant.productId)
          .select("minDeliveryCharge")
          .lean();
        shippingCharge = product?.minDeliveryCharge?.[shippingMode] ?? 0;

        orderProduct = {
          productId:     variant.productId,
          variantId:     variant._id,
          itemType:      "variant",
          price:         unitPrice,
          quantity:      qty,
          affiliateCode: affiliateCode ?? null,
        };
      }

      const productTotal = unitPrice * qty;

      // ── 4. Free delivery check ───────────────────────────────────────────
      const finalShippingCharge = await applyFreeDelivery(
        productTotal,
        shippingCharge,
        shippingMode,
      );
      const freeDeliveryApplied = finalShippingCharge === 0 && shippingCharge > 0;

      // ── 5. Resolve referral token ────────────────────────────────────────
      let referral = null;
      if (refToken) {
        referral = await ReferralService.resolveToken(refToken);
      }

      // ── 6. Wallet PREVIEW (pure math, no DB writes, no orderId needed) ───
      //    Calculates walletDiscount + onlineAmount so we can store them on
      //    the order doc. Actual deduction happens in step 9 with real orderId.
      const rawTotal     = productTotal + finalShippingCharge;
      let walletDiscount = 0;
      let onlineAmount   = 0;

      if (paymentMethod === "WALLET") {
        const preview  = await BuyNowService._previewWalletPayment(
          userId,
          rawTotal,
          walletOption,
        );
        walletDiscount = preview.walletDiscount;
        onlineAmount   = preview.onlineAmount;
      }

      const grandTotal       = rawTotal;
      const paymentSessionId = crypto.randomUUID();

      // ── 7. Derive order / payment status ────────────────────────────────
      const isCOD             = paymentMethod === "COD";
      const isFullyWalletPaid = paymentMethod === "WALLET" && onlineAmount === 0;
      const isPartialWallet   = paymentMethod === "WALLET" && onlineAmount > 0;

      const initialPaymentStatus = isCOD || isFullyWalletPaid ? "PAID"    : "UNPAID";
      const initialOrderStatus   = isCOD || isFullyWalletPaid ? "ORDERED" : "PENDING";

      // ── 8. Create order ──────────────────────────────────────────────────
      const [order] = await orderModel.create(
        [
          {
            customerId:     userId,
            product:        [orderProduct],
            orderTotal:     grandTotal,
            shippingCharge: finalShippingCharge,
            shippingMode,
            walletDiscount,
            onlineAmount,
            walletOption:   paymentMethod === "WALLET" ? walletOption : null,
            paymentMethod,
            paymentStatus:  initialPaymentStatus,
            status:         initialOrderStatus,
            referralToken:  refToken ?? null,
            referrerId:     referral?.referrerId ?? null,
            address:        addressId,
            paymentSessionId,
            affiliateCode:  affiliateCode ?? null,
          },
        ],
        { session },
      );

      // ── 9. Wallet EXECUTE (real orderId available now) ───────────────────
      //    Calls WalletService with the real order._id so wallet transaction
      //    logs are correctly linked. Safe — no null userId/orderId issue.
      if (paymentMethod === "WALLET") {
        await BuyNowService._executeWalletPayment(
          userId,
          rawTotal,
          walletOption,
          order._id,
          session,
        );
      }

      // ── 10. Razorpay (ONLINE or partial-wallet) ──────────────────────────
      let razorpayOrder   = null;
      const needsRazorpay = paymentMethod === "ONLINE" || isPartialWallet;

      if (needsRazorpay) {
        const chargeAmount = isPartialWallet ? onlineAmount : grandTotal;
        razorpayOrder = await razorpay.orders.create({
          amount:   Math.round(chargeAmount * 100),
          currency: "INR",
          receipt:  `buynow_${order._id}`,
        });
      }

      // ── 11. Transaction record ───────────────────────────────────────────
      const [transaction] = await transactionModel.create(
        [
          {
            orderId:         order._id,
            customerId:      userId,
            amount:          isPartialWallet ? onlineAmount : grandTotal,
            razorpayOrderId: razorpayOrder?.id ?? null,
            paymentMethod,
            status:          "CREATED",
            paymentSessionId,
          },
        ],
        { session },
      );

      // ── 12. Immediate settlement (COD / fully-wallet-paid) ───────────────
      if (isCOD || isFullyWalletPaid) {
        await BuyNowService._deductStock(
          [{ type: itemType, id: itemId, qty }],
          session,
        );

        if (affiliateCode) {
          await AffiliateService.recordCommission({
            affiliateCode,
            orderId:     order._id,
            buyerId:     userId,
            orderAmount: productTotal,
            itemType,
            itemId,
          });
        }
      }

      await session.commitTransaction();
      session.endSession();

      await redisClient.del(`orders:${userId}`);

      return {
        order,
        transaction,
        razorpayOrderId: razorpayOrder?.id ?? null,
        razorpayKey:     needsRazorpay ? process.env.RAZORPAY_KEY_ID : undefined,
        breakdown: {
          productTotal,
          shippingCharge:         finalShippingCharge,
          originalShippingCharge: shippingCharge,
          freeDeliveryApplied,
          shippingMode,
          walletDiscount,
          onlineAmount,
          grandTotal,
        },
      };
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

      // ── Verify Razorpay signature ────────────────────────────────────────
      const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expected !== razorpay_signature) {
        throw new AppError("Invalid payment signature", 400);
      }

      const transaction = await transactionModel
        .findOne({ orderId, razorpayOrderId: razorpay_order_id })
        .session(session);
      if (!transaction) throw new AppError("Transaction not found", 404);

      const order = await orderModel.findById(orderId).session(session);
      if (!order) throw new AppError("Order not found", 404);

      // ── Update transaction ───────────────────────────────────────────────
      transaction.status            = "SUCCESS";
      transaction.razorpayPaymentId = razorpay_payment_id;
      transaction.razorpaySignature = razorpay_signature;
      await transaction.save({ session });

      // ── Update order ─────────────────────────────────────────────────────
      order.paymentStatus = "PAID";
      order.status        = "ORDERED";
      order.transactionId = transaction._id;
      await order.save({ session });

      // ── Deduct stock ─────────────────────────────────────────────────────
      const item = order.product[0]; // BuyNow always has exactly 1 item
      await BuyNowService._deductStock(
        [
          {
            type: item.itemType,
            id:   item.itemType === "combo" ? item.comboId : item.variantId,
            qty:  item.quantity,
          },
        ],
        session,
      );

      // ── Award coins ──────────────────────────────────────────────────────
      const totalCoins = await BuyNowService._calculateItemCoins(item);
      if (totalCoins > 0) {
        await WalletService.creditCoins(
          order.customerId,
          totalCoins,
          order._id,
          session,
        );
      }

      // ── Referral commission ──────────────────────────────────────────────
      if (order.referrerId && order.referralToken) {
        const referral = await ReferralService.resolveToken(order.referralToken);
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
            buyerId:           order.customerId,
            orderId:           order._id,
            orderAmount:       order.orderTotal,
            commissionPercent: referral.commissionPercent,
            commissionAmount,
          });
        }
      }

      // ── Affiliate commission ─────────────────────────────────────────────
      const affCode = item.affiliateCode || order.affiliateCode;
      if (affCode) {
        await AffiliateService.recordCommission({
          affiliateCode: affCode,
          orderId:       order._id,
          buyerId:       order.customerId,
          orderAmount:   item.price * item.quantity,
          itemType:      item.itemType,
          itemId:        item.itemType === "combo" ? item.comboId : item.variantId,
        });
      }

      await session.commitTransaction();
      session.endSession();

      await redisClient.del(`orders:${order.customerId}`);

      const populatedOrder = await BuyNowService._populateOrder(order._id);
      return { order: populatedOrder, transaction };
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  /**
   * PHASE 1 — Preview wallet payment (pure math, zero DB writes).
   *
   * Reads the wallet document once and calculates walletDiscount + onlineAmount.
   * Does NOT call WalletService — avoids the null-orderId duplicate-key crash.
   *
   * BALANCE  → throws immediately if balance is insufficient (fail-fast).
   * COINS    → uses as many coins as possible, remainder goes online.
   * REFERRAL → uses as much referral balance as possible, remainder goes online.
   */
  static async _previewWalletPayment(userId, totalAmount, walletOption) {
    const wallet = await walletModel.findOne({ userId }).lean();

    const COIN_RATE    = wallet?.coinConversionRate ?? 10;
    let walletDiscount = 0;

    if (walletOption === "BALANCE") {
      const balance = wallet?.balance ?? 0;
      if (balance < totalAmount) {
        throw new AppError(
          `Insufficient wallet balance. Available: ₹${balance.toFixed(2)}, Required: ₹${totalAmount.toFixed(2)}. Please top-up or choose another payment option.`,
          400,
        );
      }
      walletDiscount = totalAmount; // full cover guaranteed

    } else if (walletOption === "COINS") {
      const coinsInRs = (wallet?.coins ?? 0) / COIN_RATE;
      walletDiscount  = parseFloat(Math.min(coinsInRs, totalAmount).toFixed(2));

    } else if (walletOption === "REFERRAL") {
      const refBal   = wallet?.referralBalance ?? 0;
      walletDiscount = parseFloat(Math.min(refBal, totalAmount).toFixed(2));
    }

    return {
      walletDiscount,
      onlineAmount: parseFloat((totalAmount - walletDiscount).toFixed(2)),
    };
  }

  /**
   * PHASE 2 — Execute wallet deduction (called AFTER order is created).
   *
   * Delegates to the correct WalletService method with the real orderId
   * so wallet transaction logs are correctly linked to the order.
   */
  static async _executeWalletPayment(userId, totalAmount, walletOption, orderId, session) {
    if (walletOption === "BALANCE") {
      await WalletService.payWithWallet(userId, totalAmount, orderId, session);

    } else if (walletOption === "COINS") {
      await WalletService.redeemCoins(userId, totalAmount, orderId, session);

    } else if (walletOption === "REFERRAL") {
      await WalletService.redeemReferral(userId, totalAmount, orderId, session);
    }
  }

  /**
   * Atomic stock deduction. Supports variant and combo.
   * Uses findOneAndUpdate with stock >= qty guard to prevent overselling.
   */
  static async _deductStock(deductions, session) {
    for (const d of deductions) {
      const Model = d.type === "combo" ? comboModel : variantModel;
      const label = d.type === "combo" ? "Combo" : "Variant";

      const updated = await Model.findOneAndUpdate(
        { _id: d.id, stock: { $gte: d.qty } },
        { $inc: { stock: -d.qty } },
        { session, new: true },
      );
      if (!updated)
        throw new AppError(`${label} stock insufficient at checkout`, 400);
    }
  }

  /**
   * Calculate coins to award for a single order item.
   */
  static async _calculateItemCoins(item) {
    if (item.itemType === "combo") {
      const combo = await comboModel
        .findById(item.comboId)
        .select("coinsReward")
        .lean();
      return (combo?.coinsReward ?? 0) * item.quantity;
    }
    const variant = await variantModel
      .findById(item.variantId)
      .select("coinsReward")
      .lean();
    return (variant?.coinsReward ?? 0) * item.quantity;
  }

  /**
   * Deep-populate order for API response.
   * Flattens nested address refs into plain strings.
   */
  static async _populateOrder(orderId) {
    const order = await orderModel
      .findById(orderId)
      .populate({
        path:     "address",
        select:   "street city state country pincode",
        populate: [
          { path: "city",    select: "name" },
          { path: "state",   select: "name" },
          { path: "country", select: "name" },
          { path: "pincode", select: "code" },
        ],
      })
      .populate("product.productId", "name icon")
      .populate("product.variantId", "mrp finalPrice discount size")
      .populate("product.comboId",   "name icon comboPrice")
      .lean();

    const addr = order?.address ?? {};
    order.address = {
      street:  addr.street        ?? null,
      city:    addr.city?.name    ?? null,
      state:   addr.state?.name   ?? null,
      country: addr.country?.name ?? null,
      pincode: addr.pincode?.code ?? null,
    };

    return order;
  }
}