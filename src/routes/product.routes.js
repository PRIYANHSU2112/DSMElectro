import express from "express";
import ProductController from "../controllers/product.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";
import ObjectStorageService from "../middlewares/uploads.js";

const router = express.Router();

router.post(
  "/create/product",
  authUser,
  adminMiddleware,
  ObjectStorageService.s3Uploader().fields([
    { name: "icon", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  ProductController.createProduct,
);

router.put(
  "/product/:id",
  authUser,
  adminMiddleware,
  ObjectStorageService.s3Uploader().fields([
    { name: "icon", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  ProductController.updateProduct,
);

router.get(
  "/product/:id/with-variants",
  authUser,
  ProductController.getProductWithVariants,
);

router.get("/products", authUser, ProductController.getAllProducts);

router.get(
  "/products/admin",
  authUser,
  adminMiddleware,
  ProductController.getAllAdmin,
);

router.get("/products/user", authUser, ProductController.getAllProductUser);

router.get("/product/:id", authUser, ProductController.getProductById);

router.delete(
  "/product/:id",
  authUser,
  adminMiddleware,
  ProductController.deleteProduct,
);


router.patch(
  "/product/:id/coins-reward",
  authUser,
  adminMiddleware,
  ProductController.setCoinsReward,
);

router.patch(
  "/product/:id/referral-commission",
  authUser,
  adminMiddleware,
  ProductController.setReferralCommission,
);

router.get(
  "/products/related/cart",
  authUser,
  ProductController.getRelatedProductsFromCart,
);

router.get(
  "/products/trending",
  authUser,
  ProductController.getTrendingProducts,
);

export default router;
