import ShippingConfig from "../model/shippingConfig.model.js";

// ─── SET / UPDATE SHIPPING CONFIG (Admin) ────────────────────────────────────
export const setShippingConfig = async (req, res) => {
  try {
    const { road, air, both, freeDeliveryThreshold } = req.body;

    let config = await ShippingConfig.findOne();
    if (!config) config = new ShippingConfig();

    // ── Flat rate charges ─────────────────────────────────────────────────
    if (road !== undefined) config.road = road;
    if (air  !== undefined) config.air  = air;
    if (both !== undefined) config.both = both;

    // ── Free delivery thresholds ──────────────────────────────────────────
    // Accepts: { road: 500, air: 1000, both: 300 }
    // Pass null to explicitly disable a mode: { road: null }
    if (freeDeliveryThreshold !== undefined) {
      if (!config.freeDeliveryThreshold) config.freeDeliveryThreshold = {};

      if (Object.prototype.hasOwnProperty.call(freeDeliveryThreshold, "road"))
        config.freeDeliveryThreshold.road = freeDeliveryThreshold.road;

      if (Object.prototype.hasOwnProperty.call(freeDeliveryThreshold, "air"))
        config.freeDeliveryThreshold.air = freeDeliveryThreshold.air;

      if (Object.prototype.hasOwnProperty.call(freeDeliveryThreshold, "both"))
        config.freeDeliveryThreshold.both = freeDeliveryThreshold.both;
    }

    config.markModified("freeDeliveryThreshold"); // needed for nested object updates
    await config.save();

    res.json({
      success: true,
      message: "Shipping config updated",
      data: config,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET SHIPPING CONFIG (Public) ────────────────────────────────────────────
// Frontend uses this to show "Free delivery above ₹X" banners
export const getShippingConfig = async (req, res) => {
  try {
    const config = await ShippingConfig.findOne().lean();
    res.json({ success: true, data: config ?? {} });x
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};