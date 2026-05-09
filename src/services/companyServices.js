import companyModel from "../model/company.model.js";
import { AppError } from "../utils/apiResponse.js";
import ObjectStorageService from "../middlewares/uploads.js";

const FILE_FIELDS = [
  "banner", "loader", "fav_icon",
  "header_logo", "footer_logo", "signatory",
];

const BODY_FIELDS = [
  "site_name", "email", "phone", "phone1", "address", "gst",
  "facebook", "instagram", "linkedin", "twitter", "youtube",
  "whatsapp", "pinterest", "googleMyBusiness", "playstoreLink",
  "map", "footer_description", "footer_about", "header_link", "footer_link",
  "seo_keyword", "seo_description", "description", "about_us",
  "term_condition", "privacy_policy", "return_policy", "refund_policy",
  "shippingAndDelivery", "theme_color", "font_style",
  "productDeliveryFee", "minDelAmount", "adminCharge",
];

export default class CompanyService {

  static async getCompany() {
    const company = await companyModel.findOne();
    if (!company) throw new AppError("Company not found", 404);
    return company;
  }

  static async updateCompany(body, files) {
    let company = await companyModel.findOne();
    if (!company) company = await companyModel.create({});

    const update = {};

    // file fields
    for (const field of FILE_FIELDS) {
      if (files?.[field]?.[0]) {
        if (company[field]) {
          await ObjectStorageService.deleteFile(company[field]).catch(() => {});
        }
        update[field] = files[field][0].key || files[field][0].location;
      }
    }

    // scalar body fields
    for (const field of BODY_FIELDS) {
      if (typeof body[field] !== "undefined") {
        update[field] = body[field];
      }
    }

    // onboarding data + images
    let onboardingData = body.ONBOARDING_DATA;
    if (typeof onboardingData === "string") {
      try { onboardingData = JSON.parse(onboardingData); } catch { /* ignore */ }
    }

    const onboardingFiles = files?.onboarding_images || [];
    if (onboardingFiles.length) {
      if (Array.isArray(onboardingData)) {
        onboardingData = onboardingData.map((item, i) => ({
          ...item,
          image: onboardingFiles[i]?.location || onboardingFiles[i]?.key || item.image || null,
        }));
      } else {
        onboardingData = onboardingFiles.map((file) => ({
          title: "", subtitle: "", color: "",
          image: file.location || file.key || null,
        }));
      }
    }

    if (Array.isArray(onboardingData)) {
      update.ONBOARDING_DATA = onboardingData;
    }

    const updated = await companyModel.findOneAndUpdate(
      { _id: company._id },
      { $set: update },
      { new: true }
    );

    return updated;
  }
}