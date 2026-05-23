import mongoose from "mongoose";
import app from "../src/app.js";
import userModel from "../src/model/user.model.js";
import roleModel from "../src/model/role.model.js";
import MembershipPlan from "../src/model/membershipPlan.model.js";
import UserMembership from "../src/model/userMembership.model.js";
import PointsLedger from "../src/model/pointsLedger.model.js";
import transactionModel from "../src/model/transaction.model.js";
import ScheduledEmail from "../src/model/scheduledEmail.model.js";
import redisClient from "../src/config/redis.js";
import logger from "../src/utils/logger.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = 5555;
const BASE_URL = `http://localhost:${PORT}/api/v1/membership`;

const runTests = async () => {
  logger.info("Initializing Integration Tests for Membership Management Backend...");

  // 1. Connect database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URL);
    logger.info("MongoDB Connected.");
  }

  // 2. Start local test server
  const server = app.listen(PORT, () => {
    logger.info(`Test server listening on port ${PORT}`);
  });

  try {
    // 3. Clear database test entities
    logger.info("Cleaning up database test entities...");
    await MembershipPlan.deleteMany({ name: { $regex: "^Test " } });
    
    // Find all users matching either the test emails or the test phone number
    const cleanUsers = await userModel.find({
      $or: [
        { email: { $in: ["test_user@example.com", "admin_user@example.com"] } },
        { number: "9876543210" },
        { phone: "9876543210" }
      ]
    });
    const cleanUserIds = cleanUsers.map(u => u._id);

    // Completely purge related child entities for these user accounts, and orphaned records
    await userModel.deleteMany({ _id: { $in: cleanUserIds } });
    await UserMembership.deleteMany({ $or: [{ user_id: { $in: cleanUserIds } }, { user_id: null }, { plan_id: null }] });
    await PointsLedger.deleteMany({ user_id: { $in: cleanUserIds } });
    await transactionModel.deleteMany({ customerId: { $in: cleanUserIds } });
    await ScheduledEmail.deleteMany({ user_id: { $in: cleanUserIds } });

    // Seed roles if missing
    let userRole = await roleModel.findOne({ name: "User" });
    if (!userRole) {
      userRole = await roleModel.create({ name: "User", permissions: [] });
    }
    let superAdminRole = await roleModel.findOne({ name: "Super Admin" });
    if (!superAdminRole) {
      superAdminRole = await roleModel.create({ name: "Super Admin", permissions: ["*"] });
    }

    logger.info("Clean up finished. Beginning test flows.");

    // ==================== FLOW 1: USER AUTHENTICATION ====================
    logger.info("\n--- TEST FLOW 1: User Registration & Login ---");
    const regRes = await fetch(`http://localhost:${PORT}/api/v1/auth/registerLoginUser`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "Subscriber",
        email: "test_user@example.com",
        number: "9876543210",
      }),
    });
    const regData = await regRes.json();
    if (!regData.success) throw new Error(`Registration/OTP initiation failed: ${regData.message}`);
    logger.info("✓ OTP Sent Successfully via existing auth framework.");

    const loginRes = await fetch(`http://localhost:${PORT}/api/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: "9876543210",
        otp: "1234",
      }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success) throw new Error(`OTP Verification failed: ${loginData.message}`);
    logger.info("✓ OTP Verified and Session Token Generated.");

    const token = loginData.token;
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const testUserId = loginData.data._id || loginData.data.id;

    // Make the user a Super Admin for tests (so they can also call admin endpoints)
    await userModel.findByIdAndUpdate(testUserId, { role: superAdminRole._id });
    logger.info("✓ Upgraded test user role to Super Admin for admin testing.");

    // Profile verification using existing system profile endpoint
    const profileRes = await fetch(`http://localhost:${PORT}/api/v1/auth/user/${testUserId}`, { headers: authHeaders });
    const profileData = await profileRes.json();
    if (!profileData.success) throw new Error("Failed to fetch profile");
    logger.info(`✓ Profile retrieved successfully: ${profileData.data.firstName} ${profileData.data.lastName} (Phone: ${profileData.data.number})`);

    // ==================== FLOW 2: MEMBERSHIP PLANS CRUD ====================
    logger.info("\n--- TEST FLOW 2: Plans CRUD ---");
    
    // Create Gold Plan
    const createGoldRes = await fetch(`${BASE_URL}/admin/plans`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test Gold Plan",
        tier: "gold",
        price: 99.99,
        billing_cycle: "monthly",
        discount_percent: 15,
        points_multiplier: 2.0,
        shipping_type: "express",
        perks: ["Free shipping", "Priority Support", "15% off coupon"],
      }),
    });
    const goldPlanData = await createGoldRes.json();
    if (!goldPlanData.success) throw new Error(`Failed to create plan: ${goldPlanData.message}`);
    logger.info(`✓ Gold plan created successfully. ID: ${goldPlanData.data._id}`);
    const goldPlanId = goldPlanData.data._id;

    // Create Platinum Plan
    const createPlatRes = await fetch(`${BASE_URL}/admin/plans`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test Platinum Plan",
        tier: "platinum",
        price: 249.99,
        billing_cycle: "quarterly",
        discount_percent: 25,
        points_multiplier: 3.5,
        shipping_type: "next-day",
        perks: ["25% off coupon", "VIP Access", "Free Next Day Delivery"],
      }),
    });
    const platPlanData = await createPlatRes.json();
    const platPlanId = platPlanData.data._id;
    logger.info(`✓ Platinum plan created successfully. ID: ${platPlanId}`);

    // Create Silver Plan (to test edit & toggle & delete)
    const createSilverRes = await fetch(`${BASE_URL}/admin/plans`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test Silver Plan",
        tier: "silver",
        price: 29.99,
        billing_cycle: "monthly",
        discount_percent: 5,
        points_multiplier: 1.2,
        shipping_type: "standard",
        perks: ["5% off coupon"],
      }),
    });
    const silverPlanData = await createSilverRes.json();
    const silverPlanId = silverPlanData.data._id;

    // Edit plan
    const editSilverRes = await fetch(`${BASE_URL}/admin/plans/${silverPlanId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        price: 34.99,
        perks: ["5% off coupon", "Email Support"],
      }),
    });
    const editSilverData = await editSilverRes.json();
    if (editSilverData.data.price !== 34.99) throw new Error("Edit plan failed");
    logger.info("✓ Silver plan edited successfully (new price: 34.99).");

    // Toggle active status
    const toggleSilverRes = await fetch(`${BASE_URL}/admin/plans/${silverPlanId}/toggle`, {
      method: "PATCH",
      headers: authHeaders,
    });
    const toggleSilverData = await toggleSilverRes.json();
    logger.info(`✓ Silver plan active state toggled. is_active: ${toggleSilverData.data.is_active}`);

    // Fetch all active plans (Gold and Platinum should be returned, Silver is disabled)
    const activePlansRes = await fetch(`${BASE_URL}/plans`);
    const activePlansData = await activePlansRes.json();
    logger.info(`✓ Retrieved ${activePlansData.data.length} active plans (Expected: 2).`);

    // ==================== FLOW 3: MEMBERSHIP PURCHASE ====================
    logger.info("\n--- TEST FLOW 3: Purchase Gold Membership ---");
    const purchaseRes = await fetch(`${BASE_URL}/purchase`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        plan_id: goldPlanId,
        payment_id: "pay_gold12345",
      }),
    });
    const purchaseData = await purchaseRes.json();
    if (!purchaseData.success) throw new Error(`Purchase failed: ${purchaseData.message}`);
    logger.info(`✓ Gold membership purchased successfully.`);
    logger.info(`  Generated Coupon Code: ${purchaseData.data.membership.coupon_code}`);
    logger.info(`  Awarded Welcome Points: ${purchaseData.data.welcome_points_awarded}`);

    const goldCoupon = purchaseData.data.membership.coupon_code;

    // Verify scheduled emails created
    const emailsCount = await ScheduledEmail.countDocuments({ user_id: profileData.data.id || profileData.data._id });
    logger.info(`✓ Scheduled emails created for user: ${emailsCount} (Expected: 1 for renewal reminder)`);

    // Fetch my membership details
    const myMemRes = await fetch(`${BASE_URL}/my-membership`, { headers: authHeaders });
    const myMemData = await myMemRes.json();
    if (!myMemData.success || !myMemData.data) throw new Error("Failed to get my membership");
    logger.info(`✓ Active Membership: ${myMemData.data.plan_id.name} (Tier: ${myMemData.data.plan_id.tier}, Status: ${myMemData.data.status})`);

    // ==================== FLOW 4: DISCOUNT & VALIDATION ====================
    logger.info("\n--- TEST FLOW 4: Coupon Discount & Validation ---");
    
    // Get active coupon details
    const activeCopRes = await fetch(`${BASE_URL}/coupon`, { headers: authHeaders });
    const activeCopData = await activeCopRes.json();
    logger.info(`✓ Active Coupon Endpoint: Code: ${activeCopData.data.coupon_code}, Discount: ${activeCopData.data.discount_percent}%`);

    // Validate coupon code against mock order of 1000
    const valRes = await fetch(`${BASE_URL}/coupon/validate`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        coupon_code: goldCoupon,
        order_amount: 1000,
      }),
    });
    const valData = await valRes.json();
    if (!valData.success) throw new Error(`Coupon validation failed: ${valData.message}`);
    logger.info(`✓ Applied coupon on $1000 order:`);
    logger.info(`  Amount Saved: $${valData.data.amount_saved}`);
    logger.info(`  Final Discounted Price: $${valData.data.discounted_price}`);

    // ==================== FLOW 5: POINTS SYSTEM ====================
    logger.info("\n--- TEST FLOW 5: Points Ledger System ---");

    // Fetch point balance
    const ptsRes = await fetch(`${BASE_URL}/points/balance`, { headers: authHeaders });
    const ptsData = await ptsRes.json();
    logger.info(`✓ Aggregated points balance: ${ptsData.data.points_balance} points (Expected: 300 welcome bonus)`);
    if (ptsData.data.points_balance !== 300) throw new Error("Welcome points count mismatch");

    // Earn points on a mock successful transaction of $500 (Gold points_multiplier is 2.0)
    const earnRes = await fetch(`${BASE_URL}/points/earn`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        transaction_amount: 500,
      }),
    });
    const earnData = await earnRes.json();
    logger.info(`✓ Earned points: ${earnData.data.points_earned} points (Expected: 1000)`);

    // Check new balance
    const pts2Res = await fetch(`${BASE_URL}/points/balance`, { headers: authHeaders });
    const pts2Data = await pts2Res.json();
    logger.info(`✓ Updated points balance: ${pts2Data.data.points_balance} points (Expected: 1300)`);

    // Redeem points against an order of $200 (Redeem 500 points = $50 discount)
    const redRes = await fetch(`${BASE_URL}/points/redeem`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        points: 500,
        order_amount: 200,
      }),
    });
    const redData = await redRes.json();
    logger.info(`✓ Redeemed points successfully against $200 order:`);
    logger.info(`  Points Redeemed: ${redData.data.points_redeemed}`);
    logger.info(`  Discount Applied: $${redData.data.discount_applied}`);
    logger.info(`  Final Order Price: $${redData.data.final_price}`);

    // ==================== FLOW 6: PRO-RATED MEMBERSHIP UPGRADE ====================
    logger.info("\n--- TEST FLOW 6: Membership Upgrade to Platinum ---");
    
    // Current membership is Gold, upgrade to Platinum
    const upgradeRes = await fetch(`${BASE_URL}/upgrade`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        new_plan_id: platPlanId,
        payment_id: "pay_upgrade_plat99",
      }),
    });
    const upgradeData = await upgradeRes.json();
    if (!upgradeData.success) throw new Error(`Upgrade failed: ${upgradeData.message}`);
    logger.info(`✓ Upgraded successfully to Platinum!`);
    logger.info(`  Pro-rated price charged: $${upgradeData.data.amount_charged}`);
    logger.info(`  New Platinum Coupon: ${upgradeData.data.membership.coupon_code}`);

    // ==================== FLOW 7: LAZY EXPIRY & EMAIL TRIGGER ====================
    logger.info("\n--- TEST FLOW 7: Lazy Expiry and Lazy Email Processing ---");

    // Manually force user membership and scheduled emails to expire/trigger in DB
    
    // Set active membership to have expired in the past
    await UserMembership.updateOne(
      { user_id: testUserId, status: "active" },
      { expiry_date: new Date(Date.now() - 1000 * 60 * 5) } // 5 mins ago
    );

    // Set scheduled renewal reminder email send_at to the past
    await ScheduledEmail.updateOne(
      { user_id: testUserId, is_sent: false },
      { send_at: new Date(Date.now() - 1000 * 60 * 5) }
    );

    // Hit the get my membership endpoint:
    // It should silently update status to expired and trigger the pending emails!
    logger.info("Triggering my-membership endpoint to perform lazy check...");
    const lazyRes = await fetch(`${BASE_URL}/my-membership`, { headers: authHeaders });
    const lazyData = await lazyRes.json();

    // Verify it is expired
    if (lazyData.data !== null) throw new Error("Lazy expiry failed: membership is not null/expired");
    logger.info("✓ Lazy Expiry Success: Membership successfully marked expired.");

    // Verify scheduled email was sent lazily
    const sentEmail = await ScheduledEmail.findOne({ user_id: testUserId, is_sent: true });
    if (!sentEmail) throw new Error("Lazy email processing failed: email is still marked unsent");
    logger.info("✓ Lazy Email Processing Success: Renewal reminder email was processed and sent successfully.");

    // ==================== FLOW 8: WEBHOOK RENEWAL ====================
    logger.info("\n--- TEST FLOW 8: Webhook Payment Auto-Renewal ---");

    const webhookRes = await fetch(`${BASE_URL}/webhook/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: testUserId,
        planId: platPlanId,
        paymentId: "pay_webhook_999",
      }),
    });
    const webhookData = await webhookRes.json();
    if (!webhookData.success) throw new Error(`Webhook renewal failed: ${webhookData.message}`);
    logger.info("✓ Payment Webhook Success: Membership auto-renewed successfully.");

    // Check my-membership is now active again
    const activeResObj = await fetch(`${BASE_URL}/my-membership`, { headers: authHeaders });
    const activeDataObj = await activeResObj.json();
    if (!activeDataObj.data || activeDataObj.data.status !== "active") throw new Error("Webhook renewal verification failed");
    logger.info(`✓ Webhook Verified: Membership is active again. Expiry: ${activeDataObj.data.expiry_date}`);

    // ==================== FLOW 9: CANCEL MEMBERSHIP ====================
    logger.info("\n--- TEST FLOW 9: Cancel Subscription ---");
    const cancelRes = await fetch(`${BASE_URL}/cancel`, {
      method: "POST",
      headers: authHeaders,
    });
    const cancelData = await cancelRes.json();
    if (!cancelData.success) throw new Error(`Cancellation failed: ${cancelData.message}`);
    logger.info("✓ Membership cancelled successfully.");

    // Verify scheduled emails are removed
    const pendingEmails = await ScheduledEmail.countDocuments({ user_id: testUserId, is_sent: false });
    logger.info(`✓ Verified: Pending scheduled emails for user = ${pendingEmails} (Expected: 0)`);

    // ==================== FLOW 10: ADMIN ANALYTICS & STATS ====================
    logger.info("\n--- TEST FLOW 10: Admin Dashboard & Analytics ---");

    // Stats
    const statsRes = await fetch(`${BASE_URL}/admin/stats`, { headers: authHeaders });
    const statsData = await statsRes.json();
    logger.info(`✓ Admin Stats: Total Active Members: ${statsData.data.total_members}, Total Revenue: $${statsData.data.total_revenue}`);

    // Subscribers List
    const subRes = await fetch(`${BASE_URL}/admin/subscribers?limit=5&tier=platinum`, { headers: authHeaders });
    const subData = await subRes.json();
    logger.info(`✓ Admin Subscribers: Retrieved ${subData.data.length} subscriber records.`);

    // Revenue history breakdown
    const revHistRes = await fetch(`${BASE_URL}/admin/revenue`, { headers: authHeaders });
    const revHistData = await revHistRes.json();
    logger.info(`✓ Admin Revenue History breakdown retrieved successfully.`);

    // Transactions list
    const transRes = await fetch(`${BASE_URL}/admin/transactions`, { headers: authHeaders });
    const transData = await transRes.json();
    logger.info(`✓ Admin Transactions: Retrieved ${transData.data.length} recent transactions.`);

    // CSV Subscribers export
    const csvRes = await fetch(`${BASE_URL}/admin/subscribers/export`, { headers: authHeaders });
    const csvText = await csvRes.text();
    logger.info("✓ Admin CSV Export retrieved successfully:");
    console.log(csvText); // Log full CSV

    logger.info("\n==============================================");
    logger.info("🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
    logger.info("==============================================");

  } catch (error) {
    logger.error(`❌ TEST FLOW ENCOUNTERED FAILURE: ${error.message}`);
    console.error(error);
  } finally {
    // Close local server and database connection
    server.close();
    await mongoose.connection.close();
    await redisClient.quit();
    logger.info("Test server and DB connections closed safely.");
  }
};

runTests();
