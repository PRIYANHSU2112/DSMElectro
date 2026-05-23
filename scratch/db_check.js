import mongoose from "mongoose";
import dotenv from "dotenv";
import UserMembership from "../src/model/userMembership.model.js";
import userModel from "../src/model/user.model.js";
import MembershipPlan from "../src/model/membershipPlan.model.js";

dotenv.config();

const checkDb = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("DB Connected.");

  const memberships = await UserMembership.find()
    .populate("user_id")
    .populate("plan_id");

  console.log("Total UserMemberships:", memberships.length);
  for (const m of memberships) {
    console.log("ID:", m._id);
    console.log("Raw user_id:", m.user_id ? m.user_id._id || m.user_id : "null");
    console.log("Populated user_id details:", m.user_id);
    console.log("Raw plan_id:", m.plan_id ? m.plan_id._id || m.plan_id : "null");
    console.log("Populated plan_id details:", m.plan_id);
    console.log("-----------------------------------------");
  }

  await mongoose.connection.close();
};

checkDb();
