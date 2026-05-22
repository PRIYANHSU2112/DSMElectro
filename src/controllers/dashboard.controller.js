import DashboardService, { getDateBoundaries } from "../services/dashboard.service.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class DashboardController {
  /**
   * GET /api/v1/dashboard
   * Full admin dashboard — all cards, summary, chart, recent orders
   */
  static getFullDashboard = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter, nocache } = req.query;
      // DEBUG: confirm what filter is actually received
      console.log(`[Dashboard] filter received: "${filter}" | nocache: ${!!nocache}`);
      const dashboard = await DashboardService.getFullDashboard(filter, !!nocache);
      return [dashboard, "Dashboard loaded successfully"];
    });

  /**
   * GET /api/v1/dashboard/products
   * Product stats only (useful for refreshing a single widget)
   */
  static getProductStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const dates = getDateBoundaries(filter);
      const stats = await DashboardService.getProductStats(dates);
      return [stats, "Product stats loaded"];
    });

  /**
   * GET /api/v1/dashboard/orders
   */
  static getOrderStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const dates = getDateBoundaries(filter);
      const stats = await DashboardService.getOrderStats(dates);
      return [stats, "Order stats loaded"];
    });

  /**
   * GET /api/v1/dashboard/revenue
   */
  static getRevenueStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const dates = getDateBoundaries(filter);
      const stats = await DashboardService.getRevenueStats(dates);
      return [stats, "Revenue stats loaded"];
    });

  /**
   * GET /api/v1/dashboard/revenue-chart?filter=2026
   */
  static getRevenueChart = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const dates = getDateBoundaries(filter);
      const chartData = await DashboardService.getRevenueChart(dates);
      return [chartData, "Charts data loaded"];
    });

  /**
   * GET /api/v1/dashboard/recent-orders?filter=2026&limit=10
   */
  static getRecentOrders = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const limit = parseInt(req.query.limit) || 10;
      const dates = getDateBoundaries(filter);
      const orders = await DashboardService.getRecentOrders(dates, limit);
      return [{ orders }, "Recent orders loaded"];
    });
}
