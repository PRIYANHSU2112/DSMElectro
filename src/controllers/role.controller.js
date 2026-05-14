import { handleApiRequest, ValidationError } from "../utils/apiResponse.js";
import RoleService from "../services/roleServices.js";
import { PERMISSIONS } from "../utils/permissions.js";

export default class RoleController {
  // GET PERMISSIONS
  static async getPermissions(req, res) {
    return handleApiRequest(req, res, async () => {
      return [{ data: PERMISSIONS }, "Permissions fetched successfully", 200];
    });
  }

  // GET ALL ROLES
  static async getAllRoles(req, res) {
    return handleApiRequest(req, res, async () => {
      const roles = await RoleService.getAllRoles();
      return [{ data: roles }, "Roles fetched successfully", 200];
    });
  }

  // CREATE ROLE
  static async createRole(req, res) {
    return handleApiRequest(req, res, async () => {
      const { name, permissions, description } = req.body;
      if (!name) throw new ValidationError("Role name is required");

      const role = await RoleService.createRole({ name, permissions, description });
      return [{ data: role }, "Role created successfully", 201];
    });
  }

  // UPDATE ROLE
  static async updateRole(req, res) {
    return handleApiRequest(req, res, async () => {
      const roleId = req.params.id;
      const updated = await RoleService.updateRole(roleId, req.body);
      return [{ data: updated }, "Role updated successfully", 200];
    });
  }

  // DELETE ROLE
  static async deleteRole(req, res) {
    return handleApiRequest(req, res, async () => {
      const roleId = req.params.id;
      await RoleService.deleteRole(roleId);
      return [{}, "Role deleted successfully", 200];
    });
  }

  // PATCH ROLE PERMISSIONS
  static async updateRolePermissions(req, res) {
    return handleApiRequest(req, res, async () => {
      const roleId = req.params.id;
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) throw new ValidationError("Permissions must be an array");

      const updated = await RoleService.updateRolePermissions(roleId, permissions);
      return [{ data: updated }, "Role permissions updated successfully", 200];
    });
  }
}
