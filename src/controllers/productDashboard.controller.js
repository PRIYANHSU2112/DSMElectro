import ProductDashboardService from "../services/productDashboard.service.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class ProductDashboardController {

  /**
   * GET /api/v1/products/dashboard
   * Full product dashboard — all cards, summary, ranking, chart
   * Query: ?filter=month|today|last_7_days|all_time|2024
   *        &sortBy=unitsSold|revenue  &categoryId=<ObjectId>  &limit=10
   */
  static getFullDashboard = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter, sortBy, categoryId, limit } = req.query;
      const dashboard = await ProductDashboardService.getFullProductDashboard({
        filter,
        sortBy:     sortBy     || "unitsSold",
        categoryId: categoryId || null,
        limit:      limit      ? parseInt(limit, 10) : 10,
      });
      return [dashboard, "Product dashboard loaded successfully"];
    });

  /**
   * GET /api/v1/products/dashboard/catalog
   * Catalog cards only: totalProducts, trending, lowStock, outOfStock, inventoryValue
   * Query: ?filter=month|today|last_7_days|all_time|2024
   */
  static getCatalogStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const stats = await ProductDashboardService.getCatalogStats(filter);
      return [stats, "Catalog stats loaded"];
    });

  /**
   * GET /api/v1/products/dashboard/sales
   * Sales cards only: revenue, unitsSold, orders — current vs previous period
   * Query: ?filter=month|today|last_7_days|all_time|2024
   */
  static getSalesStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const stats = await ProductDashboardService.getSalesStats(filter);
      return [stats, "Sales stats loaded"];
    });

  /**
   * GET /api/v1/products/dashboard/top-performers
   * Top selling products with MoM % change
   * Query: ?filter=month|today|last_7_days|all_time|2024
   *        &sortBy=unitsSold|revenue  &categoryId=<ObjectId>  &limit=10
   */
  static getTopPerformers = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter, sortBy, categoryId, limit } = req.query;
      const performers = await ProductDashboardService.getTopPerformersOnly({
        filter,
        sortBy:     sortBy     || "unitsSold",
        categoryId: categoryId || null,
        limit:      limit      ? parseInt(limit, 10) : 10,
      });
      return [{ data: performers }, "Top performers loaded"];
    });

  /**
   * GET /api/v1/products/dashboard/sales-trend
   * Daily revenue + units sold breakdown (for chart)
   * Query: ?filter=month|today|last_7_days|all_time|2024
   */
  static getSalesTrend = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const trend = await ProductDashboardService.getSalesTrendOnly(filter);
      return [{ data: trend }, "Sales trend loaded"];
    });

  /**
   * GET /api/v1/products/dashboard/out-of-stock?limit=10
   * Products with 0 stock
   */
  static getOutOfStock = (req, res) =>
    handleApiRequest(req, res, async () => {
      const limit = parseInt(req.query.limit, 10) || 10;
      const list  = await ProductDashboardService.getOutOfStockProducts(limit);
      return [{ data: list }, "Out of stock products loaded"];
    });
}
