import mongoose from "mongoose";

const shippingConfigSchema = new mongoose.Schema({
  road: { type: Number, default: 0 },
  air:  { type: Number, default: 0 },
  both: { type: Number, default: 0 },

  // ── Free delivery thresholds ─────────────────────────────────────────────
  // If productTotal >= threshold, shippingCharge is waived (₹0)
  // Priority: mode-specific (air/road) > both > null (disabled)
  freeDeliveryThreshold: {
    road: { type: Number, default: null }, // null = disabled for road
    air:  { type: Number, default: null }, // null = disabled for air
    both: { type: Number, default: null }, // null = disabled for both (fallback)
  },
});

export default mongoose.model("shippingConfig", shippingConfigSchema);