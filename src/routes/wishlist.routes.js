import express from "express";
import WishlistController from "../controllers/wishlist.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/wishlist", authUser, WishlistController.addToWishlist);

router.delete("/wishlist", authUser, WishlistController.removeFromWishlist);

router.get("/wishlist", authUser, WishlistController.getWishlist);

router.get(
  "/wishlist/user/:userId",
  authUser,
  adminMiddleware,
  WishlistController.getWishlistByUser,
);

// TOGGLE DISABLE
router.patch(
  "/wishlist/status",
  authUser,
  WishlistController.toggleWishlistStatus,
);

export default router;
