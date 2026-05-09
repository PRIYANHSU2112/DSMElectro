/**
 * Calculates the discount amount based on the coupon type and cart total.
 * 
 * @param {Object} coupon - The coupon document from the database
 * @param {Number} totalAmount - The total amount of the cart (before shipping/tax)
 * @returns {Number} - The calculated discount amount
 */
export const calculateCouponDiscount = (coupon, totalAmount) => {
  if (!coupon || !totalAmount) return 0;

  // Check if minimum purchase amount is met
  if (coupon.minPurchaseAmount && totalAmount < coupon.minPurchaseAmount) {
    return 0;
  }

  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = (totalAmount * coupon.discountValue) / 100;
    
    // Apply maximum discount cap if present
    if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
      discount = coupon.maxDiscountAmount;
    }
  } else if (coupon.discountType === "flat") {
    discount = coupon.discountValue;
  }

  // Ensure discount doesn't exceed the total amount
  return Math.min(discount, totalAmount);
};

/**
 * Validates a coupon against a user and current date.
 * 
 * @param {Object} coupon - The coupon document
 * @param {Number} userUsageCount - Number of times the user has already used this coupon
 * @returns {Object} - { isValid: Boolean, message: String }
 */
export const validateCouponRules = (coupon, userUsageCount = 0) => {
  const now = new Date();

  console.log(`[DEBUG] Coupon Validation:`);
  console.log(` - Current Time: ${now.toISOString()}`);
  console.log(` - Coupon Start: ${new Date(coupon.startDate).toISOString()}`);
  console.log(` - Coupon End:   ${new Date(coupon.endDate).toISOString()}`);

  if (!coupon.isActive) {
    return { isValid: false, message: "This coupon is no longer active" };
  }

  if (now < new Date(coupon.startDate)) {
    return { isValid: false, message: "This coupon is not valid yet" };
  }

  if (now > new Date(coupon.endDate)) {
    return { isValid: false, message: "This coupon has expired" };
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { isValid: false, message: "Coupon usage limit reached" };
  }

  // Check user specific limit
  if (coupon.userLimit && userUsageCount >= coupon.userLimit) {
    return { isValid: false, message: "You have already reached the usage limit for this coupon" };
  }

  return { isValid: true, message: "Coupon is valid" };
};
