import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorMiddlewares.js";
import authRoutes from "./routes/auth.routes.js";
import { optionalAuth, globalPermissionGuard } from "./middlewares/authMiddleware.js";
import categoryRoutes from "./routes/category.routes.js";
import subCategoryRoutes from "./routes/subCategory.routes.js";
import countryRoutes from "./routes/country.route.js";
import stateRoutes from "./routes/state.routes.js";
import cityRoutes from "./routes/city.routes.js";
import pincodeRoutes from "./routes/pincode.routes.js";
import productRoutes from "./routes/product.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import variantRoutes from "./routes/variant.routes.js";
import ratingRoutes from "./routes/rating.routes.js";
import hotDealRoutes from "./routes/hotDeal.routes.js";
import bulkInquiryRoutes from "./routes/bulkInquiry.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import wallterRoutes from "./routes/wallet.routes.js";
import companyRoutes from "./routes/company.routes.js";
import buyNowRoutes from "./routes/buyNow.routes.js";
import specialOfferRoutes from "./routes/specialOffer.routes.js";
import comboRoutes from "./routes/combo.routes.js";
import flashsSaleRoutes from "./routes/flashSale.routes.js";
import blogRoutes from "./routes/blog.routes.js";
import projectRoutes from "./routes/project.routes.js";
import faqRoutes from "./routes/faq.routes.js";
import jobRoutes from "./routes/job.routes.js";
import projectHeroRoutes from "./routes/projectHero.routes.js";
import altRoutes from "./routes/alt.routes.js";
import videoGalleryRoutes from "./routes/videoGallery.routes.js";
import affiliateRoutes from "./routes/affiliate.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import addressRoutes from "./routes/address.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import homeRoutes from "./routes/home.routes.js";
import bannerRoutes from "./routes/banner.routes.js";
import brandRoutes from "./routes/brand.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import productDashboardRoutes from "./routes/productDashboard.routes.js";
import projectDashboardRoutes from "./routes/projectDashboard.routes.js";
import searchRoutes from "./routes/search.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import roleRoutes from "./routes/role.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import membershipRoutes from "./routes/membership.routes.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.static("public"));
app.use(cors(
  {
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Allow specific HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"] // Allow specific headers
  }
));

// Routes
app.get("/", (req, res) => {
  res.send("API Running");
});


app.use("/api/v1", optionalAuth);
app.use("/api/v1", globalPermissionGuard);

app.use("/api/v1", searchRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/membership", membershipRoutes);
app.use("/api/v1", categoryRoutes);
app.use("/api/v1", countryRoutes);
app.use("/api/v1", stateRoutes);
app.use("/api/v1", cityRoutes);
app.use("/api/v1", pincodeRoutes);
app.use("/api/v1", productRoutes);
app.use("/api/v1", wishlistRoutes);
app.use("/api/v1", variantRoutes);
app.use("/api/v1", ratingRoutes);
app.use("/api/v1", hotDealRoutes);
app.use("/api/v1", bulkInquiryRoutes);
app.use("/api/v1", cartRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", wallterRoutes);
app.use("/api/v1", companyRoutes);
app.use("/api/v1", buyNowRoutes);
app.use("/api/v1", subCategoryRoutes);
app.use("/api/v1", specialOfferRoutes);
app.use("/api/v1", comboRoutes);
app.use("/api/v1", flashsSaleRoutes);
app.use("/api/v1", blogRoutes);
app.use("/api/v1", projectRoutes);
app.use("/api/v1", faqRoutes);
app.use("/api/v1", jobRoutes);
app.use("/api/v1", projectHeroRoutes);
app.use("/api/v1", altRoutes);
app.use("/api/v1", videoGalleryRoutes);
app.use("/api/v1", affiliateRoutes);
app.use("/api/v1", couponRoutes);
app.use("/api/v1", addressRoutes);
app.use("/api/v1", invoiceRoutes);
app.use("/api/v1", homeRoutes);
app.use("/api/v1/banners", bannerRoutes);
app.use("/api/v1", brandRoutes);
app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", productDashboardRoutes);
app.use("/api/v1", projectDashboardRoutes);
app.use("/api/v1", ticketRoutes);
app.use("/api/v1", roleRoutes);
app.use("/api/v1", notificationRoutes);
app.use(errorHandler);

export default app;
