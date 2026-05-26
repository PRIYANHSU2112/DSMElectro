import roleModel from "../model/role.model.js";
import userModel from "../model/user.model.js";
import { PERMISSIONS, SYSTEM_ROLES } from "./permissions.js";
import logger from "./logger.js";

export const seedRoles = async () => {
  try {
    // 1. Seed Super Admin Role
    let superAdminRole = await roleModel.findOne({ name: SYSTEM_ROLES.SUPER_ADMIN });

    if (!superAdminRole) {
      superAdminRole = await roleModel.create({
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

    // 2. Seed Regular User Role
    let userRole = await roleModel.findOne({ name: SYSTEM_ROLES.USER });
    if (!userRole) {
      userRole = await roleModel.create({
        name: SYSTEM_ROLES.USER,
        permissions: [],
        isSystemRole: true,
        description: "Default customer role",
      });
      logger.info("User role seeded successfully");
    }

    // 3. Seed Affiliate Role
    let affiliateRole = await roleModel.findOne({ name: "AFFILIATE" });
    if (!affiliateRole) {
      affiliateRole = await roleModel.create({
        name: "AFFILIATE",
        permissions: [],
        isSystemRole: true,
        description: "Affiliate partner role",
      });
      logger.info("Affiliate role seeded successfully");
    }

    // 4. Run database migrations to fix legacy string roles
    const rawUserCollection = userModel.collection;

    // Migrate Admin users to Super Admin Role ObjectId
    const adminMigration = await rawUserCollection.updateMany(
      { 
        $or: [
          { role: "ADMIN" },
          { role: "admin" },
          { role: "Super Admin" },
          { email: "admin@admin.com" }
        ] 
      },
      { $set: { role: superAdminRole._id } }
    );
    if (adminMigration.modifiedCount > 0) {
      logger.info(`Migrated ${adminMigration.modifiedCount} legacy admins to Super Admin role.`);
    }

    // Migrate Affiliate users to Affiliate Role ObjectId
    const affiliateMigration = await rawUserCollection.updateMany(
      { 
        $or: [
          { role: "AFFILIATE" },
          { role: "affiliate" }
        ] 
      },
      { $set: { role: affiliateRole._id } }
    );
    if (affiliateMigration.modifiedCount > 0) {
      logger.info(`Migrated ${affiliateMigration.modifiedCount} legacy affiliates to Affiliate role.`);
    }

    // Migrate customer users to User Role ObjectId
    const userMigration = await rawUserCollection.updateMany(
      { 
        $or: [
          { role: "USER" },
          { role: "user" },
          { role: { $exists: false } },
          { role: null }
        ] 
      },
      { $set: { role: userRole._id } }
    );
    if (userMigration.modifiedCount > 0) {
      logger.info(`Migrated ${userMigration.modifiedCount} legacy users to User role.`);
    }

  } catch (error) {
    logger.error("Error seeding roles and migrating users: " + error.message);
  }
};
