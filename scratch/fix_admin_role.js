import mongoose from "mongoose";
import dotenv from "dotenv";
import userModel from "../src/model/user.model.js";
import roleModel from "../src/model/role.model.js";

dotenv.config();

const fix = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("DB Connected.");

  // Find the real "Super Admin" role document
  const superAdminRole = await roleModel.findOne({ name: "Super Admin" });
  if (!superAdminRole) {
    console.error("Super Admin role not found in database!");
    await mongoose.connection.close();
    return;
  }

  console.log(`Found Super Admin role ID: ${superAdminRole._id}`);

  // Find user admin@admin.com (ID: 6a056dcae0f1e46f8c6288cd)
  const user = await userModel.findOne({ email: "admin@admin.com" });
  if (!user) {
    console.error("User admin@admin.com not found!");
    await mongoose.connection.close();
    return;
  }

  console.log(`Current user role ID: ${user.role}`);

  // Assign the real Super Admin role to the user
  user.role = superAdminRole._id;
  await user.save();

  console.log("SUCCESS: Assigned the real 'Super Admin' role to admin@admin.com!");

  await mongoose.connection.close();
};

fix();
