import DashboardService, { getDateBoundaries } from "../services/dashboard.service.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class DashboardController {
  /**
   * GET /api/v1/dashboard
   * Full admin dashboard — all cards, summary, chart, recent orders
   */
  static getFullDashboard = (req, res) =>
    handleApiRequest(req, res, async () => {
      const dashboard = await DashboardService.getFullDashboard();
      return [dashboard, "Dashboard loaded successfully"];
    });

  /**
   * GET /api/v1/dashboard/products
   * Product stats only (useful for refreshing a single widget)
   */
  static getProductStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const dates = getDateBoundaries();
      const stats = await DashboardService.getProductStats(dates);
      return [stats, "Product stats loaded"];
    });

  /**
   * GET /api/v1/dashboard/orders
   */
  static getOrderStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const dates = getDateBoundaries();
      const stats = await DashboardService.getOrderStats(dates);
      return [stats, "Order stats loaded"];
    });

  /**
   * GET /api/v1/dashboard/revenue
   */
  static getRevenueStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const dates = getDateBoundaries();
      const stats = await DashboardService.getRevenueStats(dates);
      return [stats, "Revenue stats loaded"];
    });

  /**
   * GET /api/v1/dashboard/revenue-chart?days=7
   */
  static getRevenueChart = (req, res) =>
    handleApiRequest(req, res, async () => {
      const days = parseInt(req.query.days) || 7;
      const chart = await DashboardService.getRevenueChart(days);
      return [{ chart }, "Revenue chart loaded"];
    });

  /**
   * GET /api/v1/dashboard/recent-orders?limit=10
   */
  static getRecentOrders = (req, res) =>
    handleApiRequest(req, res, async () => {
      const limit = parseInt(req.query.limit) || 10;
      const orders = await DashboardService.getRecentOrders(limit);
      return [{ orders }, "Recent orders loaded"];
    });
}
