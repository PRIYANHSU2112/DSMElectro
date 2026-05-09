import ShippingConfig from "../model/shippingConfig.model.js";

/**
 * Applies the free-delivery threshold rule.
 *
 * Priority for threshold lookup:
 *   1. mode-specific  (e.g. freeDeliveryThreshold.road)
 *   2. both           (freeDeliveryThreshold.both) — acts as a shared fallback
 *   3. null           — feature disabled, return rawShipping unchanged
 *
 * @param {number}        productTotal  — sum of all item prices (before shipping)
 * @param {number}        rawShipping   — shipping charge accumulated from cart items
 * @param {"air"|"road"}  mode          — chosen shipping mode
 * @returns {Promise<number>}           — final shipping charge (0 if threshold met)
 */
export async function applyFreeDelivery(productTotal, rawShipping, mode) {
  // Nothing to waive
  if (rawShipping === 0) return 0;

  const config = await ShippingConfig.findOne()
    .select("freeDeliveryThreshold")
    .lean();

  const thresholds = config?.freeDeliveryThreshold;

  // mode-specific wins; fall back to "both"; null = disabled
  const threshold = thresholds?.[mode] ?? thresholds?.both ?? null;

  if (threshold == null) return rawShipping;

  return productTotal >= threshold ? 0 : rawShipping;
}