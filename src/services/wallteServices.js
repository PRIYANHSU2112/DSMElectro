import walletModel from "../model/wallet.model.js";
import walletTransactionModel, {
  WalletTxType,
  WalletBucket,
} from "../model/walletTransaction.model.js";
import { AppError } from "../utils/apiResponse.js";

const COIN_RATE = 10; // 10 coins = 1 Rs  (override per wallet if needed)

export default class WalletService {
  // ─────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get-or-create wallet for a user.
   */
  static async _getOrCreate(userId, session) {
    let wallet = await walletModel.findOne({ userId }).session(session ?? null);
    if (!wallet) {
      [wallet] = await walletModel.create([{ userId }], {
        session: session ?? undefined,
      });
    }
    return wallet;
  }

  /**
   * Record a wallet transaction and return it.
   */
  static async _log(
    { userId, type, bucket, amount, credit, orderId, referredUserId, description, balanceAfter },
    session,
  ) {
    const [tx] = await walletTransactionModel.create(
      [{ userId, type, bucket, amount, credit, orderId, referredUserId, description, balanceAfter }],
      { session: session ?? undefined },
    );
    return tx;
  }

  // ─────────────────────────────────────────────────────────────
  // GET WALLET
  // ─────────────────────────────────────────────────────────────
  static async getWallet(userId) {
    const wallet = await WalletService._getOrCreate(userId);
    return wallet;
  }

  // ─────────────────────────────────────────────────────────────
  // TOP-UP  (add money to main balance)
  // ─────────────────────────────────────────────────────────────
  static async topUp(userId, amount, session) {
    if (!amount || amount <= 0) throw new AppError("Invalid top-up amount", 400);

    const wallet = await WalletService._getOrCreate(userId, session);
    wallet.balance += amount;
    await wallet.save({ session });

    await WalletService._log(
      {
        userId,
        type: WalletTxType.TOPUP,
        bucket: WalletBucket.BALANCE,
        amount,
        credit: true,
        description: `Wallet top-up of ₹${amount}`,
        balanceAfter: wallet.balance,
      },
      session,
    );

    return wallet;
  }

  // ─────────────────────────────────────────────────────────────
  // CREDIT COINS after purchase
  // ─────────────────────────────────────────────────────────────
  /**
   * Called by OrderService after order is confirmed.
   * coinsToAdd is the raw coin count (e.g. 50).
   */
  static async creditCoins(userId, coinsToAdd, orderId, session) {
    if (!coinsToAdd || coinsToAdd <= 0) return;

    const wallet = await WalletService._getOrCreate(userId, session);
    wallet.coins += coinsToAdd;
    await wallet.save({ session });

    const rupeesEquivalent = (coinsToAdd / COIN_RATE).toFixed(2);

    await WalletService._log(
      {
        userId,
        type: WalletTxType.COIN_EARNED,
        bucket: WalletBucket.COINS,
        amount: coinsToAdd,
        credit: true,
        orderId,
        description: `Earned ${coinsToAdd} coins (≈ ₹${rupeesEquivalent}) from purchase`,
        balanceAfter: wallet.coins,
      },
      session,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CREDIT REFERRAL COMMISSION
  // ─────────────────────────────────────────────────────────────
  static async creditReferral(userId, amount, orderId, buyerId, session) {
    if (!amount || amount <= 0) return;

    const wallet = await WalletService._getOrCreate(userId, session);
    wallet.referralBalance += amount;
    await wallet.save({ session });

    await WalletService._log(
      {
        userId,
        type: WalletTxType.REFERRAL_EARNED,
        bucket: WalletBucket.REFERRAL,
        amount,
        credit: true,
        orderId,
        referredUserId: buyerId,
        description: `Referral commission ₹${amount} credited`,
        balanceAfter: wallet.referralBalance,
      },
      session,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CHECKOUT PAYMENT HELPERS
  // These are called inside OrderService.createOrder (same session).
  // Each returns { amountDeducted, remainingToPay }
  // ─────────────────────────────────────────────────────────────

  /**
   * OPTION 1 — Pay with Coins
   * Converts user's coins to Rs, deducts from coins bucket,
   * and reduces the amount owed.
   * If coins balance < total, uses all coins and returns remainder.
   */
  static async redeemCoins(userId, totalAmount, orderId, session) {
    const wallet = await WalletService._getOrCreate(userId, session);

    const coinRate = wallet.coinConversionRate ?? COIN_RATE;
    const coinsValueInRs = wallet.coins / coinRate;

    // How much can we cover with coins?
    const deductInRs = Math.min(coinsValueInRs, totalAmount);
    const coinsToDeduct = Math.ceil(deductInRs * coinRate); // coins used
    const actualRsDeducted = parseFloat((coinsToDeduct / coinRate).toFixed(2));

    if (coinsToDeduct <= 0) {
      return { amountDeducted: 0, remainingToPay: totalAmount };
    }

    wallet.coins -= coinsToDeduct;
    await wallet.save({ session });

    await WalletService._log(
      {
        userId,
        type: WalletTxType.COIN_REDEEMED,
        bucket: WalletBucket.COINS,
        amount: coinsToDeduct,
        credit: false,
        orderId,
        description: `Redeemed ${coinsToDeduct} coins (₹${actualRsDeducted}) at checkout`,
        balanceAfter: wallet.coins,
      },
      session,
    );

    return {
      amountDeducted: actualRsDeducted,
      remainingToPay: parseFloat((totalAmount - actualRsDeducted).toFixed(2)),
    };
  }

  /**
   * OPTION 2 — Pay all with Wallet balance
   * Full payment from main balance. Throws if insufficient.
   */
  static async payWithWallet(userId, totalAmount, orderId, session) {
    const wallet = await WalletService._getOrCreate(userId, session);

    if (wallet.balance < totalAmount) {
      throw new AppError(
        `Insufficient wallet balance. Available: ₹${wallet.balance.toFixed(2)}, Required: ₹${totalAmount.toFixed(2)}. Please top-up or choose another payment option.`,
        400,
      );
    }

    wallet.balance -= totalAmount;
    await wallet.save({ session });

    await WalletService._log(
      {
        userId,
        type: WalletTxType.WALLET_PAID,
        bucket: WalletBucket.BALANCE,
        amount: totalAmount,
        credit: false,
        orderId,
        description: `Full wallet payment of ₹${totalAmount} for order`,
        balanceAfter: wallet.balance,
      },
      session,
    );

    return { amountDeducted: totalAmount, remainingToPay: 0 };
  }

  /**
   * OPTION 3 — Pay with Referral balance
   * If enough: pays everything from referralBalance.
   * If not enough: uses all referralBalance, rest goes ONLINE.
   */
  static async redeemReferral(userId, totalAmount, orderId, session) {
    const wallet = await WalletService._getOrCreate(userId, session);

    if (wallet.referralBalance <= 0) {
      return { amountDeducted: 0, remainingToPay: totalAmount };
    }

    const deduct = Math.min(wallet.referralBalance, totalAmount);
    wallet.referralBalance -= deduct;
    await wallet.save({ session });

    await WalletService._log(
      {
        userId,
        type: WalletTxType.REFERRAL_REDEEMED,
        bucket: WalletBucket.REFERRAL,
        amount: deduct,
        credit: false,
        orderId,
        description: `Referral balance ₹${deduct} used at checkout`,
        balanceAfter: wallet.referralBalance,
      },
      session,
    );

    return {
      amountDeducted: deduct,
      remainingToPay: parseFloat((totalAmount - deduct).toFixed(2)),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GET TRANSACTION HISTORY
  // ─────────────────────────────────────────────────────────────
  static async getTransactions(userId, query = {}) {
    const { page = 1, limit = 20, type, bucket } = query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const filter = { userId };
    if (type) filter.type = type;
    if (bucket) filter.bucket = bucket;

    const [data, total] = await Promise.all([
      walletTransactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      walletTransactionModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // ADMIN — manual credit / debit
  // ─────────────────────────────────────────────────────────────
  static async adminAdjust(userId, { bucket, amount, credit, description }, session) {
    const allowedBuckets = Object.values(WalletBucket);
    if (!allowedBuckets.includes(bucket)) throw new AppError("Invalid bucket", 400);
    if (!amount || amount <= 0) throw new AppError("Invalid amount", 400);

    const wallet = await WalletService._getOrCreate(userId, session);

    if (credit) {
      wallet[bucket] += amount;
    } else {
      if (wallet[bucket] < amount) throw new AppError("Insufficient balance for debit", 400);
      wallet[bucket] -= amount;
    }

    await wallet.save({ session });

    await WalletService._log(
      {
        userId,
        type: credit ? WalletTxType.ADMIN_CREDIT : WalletTxType.ADMIN_DEBIT,
        bucket,
        amount,
        credit,
        description: description ?? `Admin ${credit ? "credit" : "debit"} of ${amount}`,
        balanceAfter: wallet[bucket],
      },
      session,
    );

    return wallet;
  }
}