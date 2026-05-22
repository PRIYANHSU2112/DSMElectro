import ProjectDashboardService from "../services/projectDashboard.service.js";
import { handleApiRequest } from "../utils/apiResponse.js";

export default class ProjectDashboardController {

  /**
   * GET /api/v1/projects/dashboard
   * Full project dashboard — all cards, summary, performers, recent activity
   * Query: ?filter=month|today|last_7_days|all_time|2024
   *        &sortBy=downloads|views  &categoryId=<ObjectId>  &limit=10
   */
  static getFullDashboard = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter, sortBy, categoryId, limit } = req.query;
      const dashboard = await ProjectDashboardService.getFullProjectDashboard({
        filter,
        sortBy: sortBy || "downloads",
        categoryId: categoryId || null,
        limit: limit ? parseInt(limit, 10) : 10,
      });
      return [dashboard, "Project dashboard loaded successfully"];
    });

  /**
   * GET /api/v1/projects/dashboard/catalog
   * Catalog cards: totalProjects, byLevel, disabled, catalogValue
   * Query: ?filter=month|today|last_7_days|all_time|2024
   */
  static getCatalogStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const stats = await ProjectDashboardService.getCatalogStats(filter);
      return [stats, "Project catalog stats loaded"];
    });

  /**
   * GET /api/v1/projects/dashboard/engagement
   * Engagement cards: views, downloads, ratings — current vs previous period
   * Query: ?filter=month|today|last_7_days|all_time|2024
   */
  static getEngagementStats = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter } = req.query;
      const stats = await ProjectDashboardService.getEngagementStats(filter);
      return [stats, "Project engagement stats loaded"];
    });

  /**
   * GET /api/v1/projects/dashboard/top-performers
   * Top projects ranked by downloads or views with % vs global avg
   * Query: ?filter=...  &sortBy=downloads|views  &categoryId=...  &limit=10
   */
  static getTopPerformers = (req, res) =>
    handleApiRequest(req, res, async () => {
      const { filter, sortBy, categoryId, limit } = req.query;
      const performers = await ProjectDashboardService.getTopPerformersOnly({
        filter,
        sortBy: sortBy || "downloads",
        categoryId: categoryId || null,
        limit: limit ? parseInt(limit, 10) : 10,
      });
      return [{ data: performers }, "Top performing projects loaded"];
    });

  /**
   * GET /api/v1/projects/dashboard/recent?limit=5
   * Recently added projects
   */
  static getRecentProjects = (req, res) =>
    handleApiRequest(req, res, async () => {
      const limit = parseInt(req.query.limit, 10) || 5;
      const list = await ProjectDashboardService.getRecentProjects(limit);
      return [{ data: list }, "Recent projects loaded"];
    });

  /**
   * GET /api/v1/projects/dashboard/recent-ratings?limit=5
   * Latest user ratings across all projects
   */
  static getRecentRatings = (req, res) =>
    handleApiRequest(req, res, async () => {
      const limit = parseInt(req.query.limit, 10) || 5;
      const list = await ProjectDashboardService.getRecentRatings(limit);
      return [{ data: list }, "Recent project ratings loaded"];
    });
}
