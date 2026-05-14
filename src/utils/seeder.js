import roleModel from "../model/role.model.js";
import userModel from "../model/user.model.js";
import { PERMISSIONS, SYSTEM_ROLES } from "./permissions.js";
import logger from "./logger.js";

export const seedRoles = async () => {
  try {
    // 1. Seed Super Admin Role
    const superAdminRole = await roleModel.findOne({ name: SYSTEM_ROLES.SUPER_ADMIN });

    if (!superAdminRole) {
      await roleModel.create({
        name: SYSTEM_ROLES.SUPER_ADMIN,
        permissions: PERMISSIONS,
        isSystemRole: true,
        description: "Full access to all system features",
      });
      logger.info("Super Admin role seeded successfully");
    } else {
      superAdminRole.permissions = PERMISSIONS;
      await superAdminRole.save();
    }

    // // 2. Seed Regular User Role
    // const userRole = await roleModel.findOne({ name: SYSTEM_ROLES.USER });
    // if (!userRole) {
    //   await roleModel.create({
    //     name: SYSTEM_ROLES.USER,
    //     permissions: [],
    //     isSystemRole: true,
    //     description: "Default customer role",
    //   });
    //   logger.info("User role seeded successfully");
    // }

    // // 3. MIGRATIONS
    // const latestSuperAdmin = await roleModel.findOne({ name: SYSTEM_ROLES.SUPER_ADMIN });
    // const latestUserRole = await roleModel.findOne({ name: SYSTEM_ROLES.USER });

    // if (latestSuperAdmin) {
    //   const result = await userModel.updateMany(
    //     { 
    //       $or: [
    //         { role: "ADMIN" },
    //         { role: "admin" },
    //         { email: "admin@admin.com" }
    //       ] 
    //     },
    //     { $set: { role: latestSuperAdmin._id } }
    //   );
    //   if (result.modifiedCount > 0) {
    //     logger.info(`Migrated ${result.modifiedCount} legacy admins to Super Admin role.`);
    //   }
    // }

    // if (latestUserRole) {
    //   const result = await userModel.updateMany(
    //     { 
    //       $or: [
    //         { role: "USER" },
    //         { role: "user" },
    //         { role: { $exists: false } },
    //         { role: null }
    //       ] 
    //     },
    //     { $set: { role: latestUserRole._id }, $unset: { permissions: "" } }
    //   );
    //   if (result.modifiedCount > 0) {
    //     logger.info(`Migrated ${result.modifiedCount} legacy users to User role.`);
    //   }
    // }

  } catch (error) {
    logger.error("Error seeding roles: " + error.message);
  }
};
