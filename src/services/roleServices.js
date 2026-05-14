import roleModel from "../model/role.model.js";
import userModel from "../model/user.model.js";
import { AppError } from "../utils/apiResponse.js";
import { SYSTEM_ROLES } from "../utils/permissions.js";

export default class RoleService {
  // CREATE ROLE
  static async createRole(payload) {
    const existingRole = await roleModel.findOne({ name: payload.name });
    if (existingRole) {
      throw new AppError("Role with this name already exists", 400);
    }
    const role = await roleModel.create(payload);
    return role;
  }

  // UPDATE ROLE
  static async updateRole(roleId, payload) {
    const role = await roleModel.findById(roleId);

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    // Prevent changing name of System Roles if needed
    if (role.isSystemRole && payload.name && payload.name !== role.name) {
       // You might want to allow this or not. Usually, Super Admin name should be stable.
    }

    Object.assign(role, payload);
    await role.save();

    return role;
  }

  // DELETE ROLE
  static async deleteRole(roleId) {
    const role = await roleModel.findById(roleId);

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    if (role.isSystemRole || role.name === SYSTEM_ROLES.SUPER_ADMIN) {
      throw new AppError("Cannot delete System/Super Admin role", 403);
    }

    // Check if any users are assigned to this role
    const userCount = await userModel.countDocuments({ role: roleId });
    if (userCount > 0) {
      throw new AppError(`Cannot delete role. ${userCount} users are assigned to it.`, 400);
    }

    await role.deleteOne();

    return true;
  }

  // GET ROLE BY ID
  static async getRoleById(roleId) {
    const role = await roleModel.findById(roleId);

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    const userCount = await userModel.countDocuments({ role: roleId });

    return {
      ...role.toObject(),
      totalUsers: userCount,
    };
  }

  // GET ALL ROLES
  static async getAllRoles() {
    const roles = await roleModel.find().lean();
    
    // Calculate user counts for each role
    const rolesWithCounts = await Promise.all(
      roles.map(async (role) => {
        const count = await userModel.countDocuments({ role: role._id });
        return {
          ...role,
          totalUsers: count,
        };
      })
    );

    return rolesWithCounts;
  }

  // UPDATE ROLE PERMISSIONS
  static async updateRolePermissions(roleId, permissions) {
    const role = await roleModel.findById(roleId);

    if (!role) {
      throw new AppError("Role not found", 404);
    }

    role.permissions = permissions;
    await role.save();

    return role;
  }
}
