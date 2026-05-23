import mongoose from "mongoose";
import dotenv from "dotenv";
import userModel from "../src/model/user.model.js";
import roleModel from "../src/model/role.model.js";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("DB Connected.");

  // Fetch all roles
  const roles = await roleModel.find();
  console.log("\n=== ALL ROLES ===");
  roles.forEach(r => {
    console.log(`- ID: ${r._id}, Name: "${r.name}", SystemRole: ${r.isSystemRole}, Permissions:`, r.permissions);
  });

  // Fetch users with their populated roles
  const users = await userModel.find().populate("role");
  console.log("\n=== ALL USERS ===");
  users.forEach(u => {
    console.log(`- ID: ${u._id}, Email: "${u.email}", Phone: "${u.number || u.phone}", Role: ${u.role ? `"${u.role.name}"` : "null"}`);
  });

  await mongoose.connection.close();
};

run();
