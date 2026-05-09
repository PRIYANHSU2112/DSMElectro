import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    // Basic Info
    site_name:          { type: String, default: "Company Name" },
    email:              { type: String, default: "" },
    phone:              { type: String, default: "" },
    phone1:             { type: String, default: "" },
    address:            { type: String, default: "" },
    gst:                { type: String, default: "" },

    // Media
    banner:             { type: String, default: "" },
    loader:             { type: String, default: "" },
    fav_icon:           { type: String, default: "" },
    header_logo:        { type: String, default: "" },
    footer_logo:        { type: String, default: "" },
    signatory:          { type: String, default: "" },

    // Social
    facebook:           { type: String, default: "" },
    instagram:          { type: String, default: "" },
    linkedin:           { type: String, default: "" },
    twitter:            { type: String, default: "" },
    youtube:            { type: String, default: "" },
    whatsapp:           { type: String, default: "" },
    pinterest:          { type: String, default: "" },
    googleMyBusiness:   { type: String, default: "" },
    playstoreLink:      { type: String, default: "" },

    // Map
    map: {
      lat:  { type: Number, default: 0 },
      long: { type: Number, default: 0 },
    },

    // Footer
    footer_description: { type: String, default: "" },
    footer_about:       { type: String, default: "" },
    header_link:        { type: [String], default: [] },
    footer_link:        { type: [String], default: [] },

    // SEO
    seo_keyword:        { type: String, default: "" },
    seo_description:    { type: String, default: "" },

    // Pages
    description:        { type: String, default: "" },
    about_us:           { type: String, default: "" },
    term_condition:     { type: String, default: "" },
    privacy_policy:     { type: String, default: "" },
    return_policy:      { type: String, default: "" },
    refund_policy:      { type: String, default: "" },
    shippingAndDelivery:{ type: String, default: "" },

    // Theme
    theme_color:        { type: String, default: "#000000" },
    font_style:         { type: String, default: "sans-serif" },

    // Charges
    productDeliveryFee: { type: Number, default: 0 },
    minDelAmount:       { type: Number, default: 0 },
    adminCharge:        { type: Number, default: 0 },

    // Onboarding
    ONBOARDING_DATA: [
      {
        title:    { type: String, default: "" },
        subtitle: { type: String, default: "" },
        color:    { type: String, default: "" },
        image:    { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const companyModel = mongoose.model("company", companySchema);
export default companyModel;