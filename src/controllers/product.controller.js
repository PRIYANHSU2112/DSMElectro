import slugify from "slugify";
import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import ProductService from "../services/productServices.js";
import ProductDashboardService from "../services/productDashboard.service.js";
import { createProductWithVariantSchema } from "../validators/ProductValidation.js";

export default class ProductController {
  static async createProduct(req, res) {
    return handleApiRequest(req, res, async () => {
      const body = req.body;

      // PARSE VARIANT
      if (body.variant && typeof body.variant === "string") {
        try {
          body.variant = JSON.parse(body.variant);
        } catch {
          throw new ValidationError("Invalid variant JSON format");
        }
      }

      // PARSE LOCATION ARRAYS
      const locationFields = ["countries", "states", "cities", "pincodes"];
      for (const field of locationFields) {
        const val = body[field];
        if (!val) continue;
        try {
          let parsed = typeof val === "string" ? JSON.parse(val) : val;
          body[field] = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          throw new ValidationError(`Invalid ${field} format`);
        }
      }

      // VALIDATION
      const { error } = createProductWithVariantSchema.validate(body);
      if (error) throw new ValidationError(error.details[0].message);

      // SLUG + PAYLOAD
      const payload = {
        ...body,
        slug: slugify(body.name, { lower: true, strict: true }),
        icon: req.files?.icon?.[0]?.location ?? null,
        images: req.files?.images?.map((f) => f.location) ?? [],
      };

      const result = await ProductService.createProductWithVariant(payload);

      return [
        { data: result },
        "Product created successfully with variants",
        201,
      ];
    });
  }

  static async updateProduct(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;
      const body = req.body;

      if (body.variant && typeof body.variant === "string") {
        try {
          body.variant = JSON.parse(body.variant);
        } catch {
          throw new ValidationError("Invalid variant JSON format");
        }
      }

      const result = await ProductService.updateProduct(id, body, req.files);
      return [{ data: result }, "Product updated successfully"];
    });
  }

  static async getAllProducts(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProductService.getAllProducts(req.query);
      return [{ data: result }, "Products fetched"];
    });
  }
  static async getAllAdmin(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProductService.getAllProductsAdmin(req.query);
      return [{ data: result }, "Admin products fetched"];
    });
  }

  static async getAllProductUser(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProductService.getAllProducts(req.query);
      return [{ data: result }, "User products fetched"];
    });
  }

  static async getProductById(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;

      console.log("ENV:", process.env.NODE_ENV);

      const result = await ProductService.getProductById(id);

      return [{ data: result }, "Product fetched successfully", 200];
    });
  }

  static async deleteProduct(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;

      await ProductService.deleteProduct(id);

      return [{}, "Product deleted successfully", 200];
    });
  }

  static async getProductWithVariants(req, res) {
    return handleApiRequest(req, res, async () => {
      const { id } = req.params;

      const result = await ProductService.getProductWithVariants(id);

      return [
        { data: result },
        "Product with variants fetched successfully",
        200,
      ];
    });
  }


static async setCoinsReward(req, res) {
  return handleApiRequest(req, res, async () => {
    const result = await ProductService.setCoinsReward(
      req.params.id,
      req.body.coinsReward,
    );
    return [{ data: result }, "Coins reward updated on product and all its variants"];
  });
}
 
static async setReferralCommission(req, res) {
  return handleApiRequest(req, res, async () => {
    const result = await ProductService.setReferralCommission(
      req.params.id,
      req.body.referralCommissionPercent,
    );
    return [{ data: result }, "Referral commission updated on product and all its variants"];
  });
}
 
  static async getRelatedProductsFromCart(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProductService.getRelatedByCart(req.user._id);
      return [{ data: result }, "Related products fetched based on cart items"];
    });
  }

  static async getTrendingProducts(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProductService.getTrendingProducts(req.query);
      return [{ data: result }, "Trending products fetched successfully", 200];
    });
  }

  static async getNewArrivals(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProductService.getNewArrivalProducts(req.query);
      return [{ data: result }, "New arrival products fetched successfully", 200];
    });
  }

  static async getBestSelling(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await ProductService.getBestSellingProducts(req.query);
      return [{ data: result }, "Best selling products fetched successfully", 200];
    });
  }

  // GET /products/dashboard
  // Query: ?sortBy=unitsSold|revenue  &categoryId=...  &limit=10
  static async getProductDashboard(req, res) {
    return handleApiRequest(req, res, async () => {
      const { sortBy, categoryId, limit } = req.query;
      const result = await ProductDashboardService.getProductDashboard({
        sortBy:     sortBy     || "unitsSold",
        categoryId: categoryId || null,
        limit:      limit      ? parseInt(limit, 10) : 10,
      });
      return [{ data: result }, "Product dashboard fetched successfully"];
    });
  }
}
