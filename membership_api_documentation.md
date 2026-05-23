# DSM Electro - Membership Management System API Documentation

This document provides a comprehensive integration guide for the **Frontend Team** to connect and consume the Membership Management System APIs. All responses follow the standard DSM Electro JSON wrapper format.

---

## 1. Global Specifications

### Base URL
* **Development**: `http://localhost:2000/api/v1`
* **Production**: `https://api.dsmonline.in/api/v1`

### Standard Response Format
All APIs return a standardized JSON envelope. The frontend should always read properties inside the root `data` wrapper:

#### Success Response
```json
{
  "success": true,
  "message": "Plans retrieved successfully",
  "data": { ... } // Can be an object, array, or null
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Invalid plan ID specified"
}
```

---

## 2. Authentication Flow (Existing System Alignment)

Before calling any protected membership routes, you must authenticate the user using the existing OTP framework.

### A. Register / Send OTP
* **Route**: `POST /auth/registerLoginUser`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "johndoe@example.com",
    "number": "9876543210"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully"
  }
  ```

### B. Verify OTP & Obtain Session Token
* **Route**: `POST /auth/verify-otp`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "number": "9876543210",
    "otp": "1234"
  }
  ```
* **Response (Saves in LocalStorage/State)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "data": {
      "_id": "6a012345ef...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "johndoe@example.com",
      "number": "9876543210"
    }
  }
  ```
> **Frontend Tip**: Store `token` and attach it to all protected routes in the header as:
> `Authorization: Bearer <your_jwt_token>`

---

## 3. Membership Plans APIs

### A. Get All Active Plans
* **Route**: `GET /membership/plans`
* **Access**: Public (No Headers Required)
* **Response `data` Description**: Returns an array of active membership plans. These results are optimized with a 24-hour Redis cache.
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Active plans retrieved successfully",
    "data": [
      {
        "_id": "6a11497f1a2b...",
        "name": "Gold Premium Plan",
        "tier": "gold",
        "price": 199.99,
        "billing_cycle": "monthly",
        "discount_percent": 15,
        "points_multiplier": 2,
        "shipping_type": "express",
        "perks": [
          "Free Express Shipping",
          "15% discount coupon linked to account",
          "2x reward points on all purchases"
        ],
        "is_active": true
      }
    ]
  }
  ```

### B. Get Single Plan Details
* **Route**: `GET /membership/plans/:id`
* **Access**: Public
* **URL Params**: `:id` (The Mongoose ObjectID of the plan)
* **Response `data` Description**: Single plan details.

---

## 4. User Membership Actions (Protected)
All routes in this section require the header: `Authorization: Bearer <token>`

### A. Purchase Membership (Razorpay Integration)
* **Route**: `POST /membership/purchase`
* **Access**: User Protected
* **Request Body**:
  ```json
  {
    "plan_id": "6a11497f1a2b...",
    "payment_id": "pay_razorpay_12345abc" // Razorpay Payment ID returned by SDK
  }
  ```
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Membership plan purchased successfully",
    "data": {
      "membership": {
        "_id": "6a11497f1e9c...",
        "user_id": "6a012345ef...",
        "plan_id": "6a11497f1a2b...",
        "start_date": "2026-05-23T06:30:24.369Z",
        "expiry_date": "2026-06-23T06:30:24.369Z",
        "status": "active",
        "coupon_code": "GOLD-V8FKW"
      },
      "transaction": {
        "_id": "6a11497f1e9f...",
        "customerId": "6a012345ef...",
        "amount": 199.99,
        "paymentGateway": "RAZORPAY",
        "razorpayPaymentId": "pay_razorpay_12345abc",
        "status": "SUCCESS"
      },
      "welcome_points_awarded": 300
    }
  }
  ```

### B. Fetch My Current Subscription Details
* **Route**: `GET /membership/my-membership`
* **Access**: User Protected
* **Response `data` Description**: Returns the active subscription details along with plan perks.
* **Lazy Trigger Detail**: This API automatically triggers lazy checks (verifies if subscription is expired in the background and processes queued notifications), so the frontend doesn't need to track status client-side!
* **Sample Response (Active)**:
  ```json
  {
    "success": true,
    "message": "My active membership details and perks fetched successfully",
    "data": {
      "_id": "6a11497f1e9c...",
      "status": "active",
      "coupon_code": "GOLD-V8FKW",
      "plan_id": {
        "_id": "6a11497f1a2b...",
        "name": "Gold Premium Plan",
        "tier": "gold",
        "price": 199.99,
        "billing_cycle": "monthly",
        "discount_percent": 15
      },
      "start_date": "2026-05-23T06:30:24.369Z",
      "expiry_date": "2026-06-23T06:30:24.369Z"
    }
  }
  ```
* **Sample Response (No Active Plan / Expired)**:
  ```json
  {
    "success": true,
    "message": "No active membership subscription found",
    "data": null
  }
  ```

### C. Upgrade Membership (Pro-Rated Upgrade)
* **Route**: `POST /membership/upgrade`
* **Access**: User Protected
* **Request Body**:
  ```json
  {
    "new_plan_id": "6a11497f1a2z...", // ID of the higher-tier plan (e.g. Platinum)
    "payment_id": "pay_razorpay_upgrade888" // Razorpay Payment ID returned by SDK
  }
  ```
* **Business Logic**: Automatically calculates the unused balance of the current plan and deducts it. The user only pays the pro-rated price difference.
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Membership subscription upgraded successfully",
    "data": {
      "membership": {
        "_id": "6a11497f1e9c...",
        "plan_id": "6a11497f1a2z...",
        "status": "active",
        "coupon_code": "PLATINUM-6OIBQ"
      },
      "amount_charged": 150.00 // Calculated difference charged
    }
  }
  ```

### D. Cancel Membership
* **Route**: `POST /membership/cancel`
* **Access**: User Protected
* **Response**:
  ```json
  {
    "success": true,
    "message": "Membership cancelled successfully",
    "data": null
  }
  ```

---

## 5. Discount Coupon Engine (Protected)

Each membership tier yields a custom coupon linked to the account.

### A. Get My Active Account Coupon
* **Route**: `GET /membership/coupon`
* **Access**: User Protected
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Active coupon retrieved successfully",
    "data": {
      "coupon_code": "GOLD-V8FKW",
      "discount_percent": 15
    }
  }
  ```

### B. Validate & Apply Coupon on Cart
* **Route**: `POST /membership/coupon/validate`
* **Access**: User Protected
* **Request Body**:
  ```json
  {
    "coupon_code": "GOLD-V8FKW",
    "order_amount": 1000.00
  }
  ```
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Coupon applied successfully",
    "data": {
      "coupon_code": "GOLD-V8FKW",
      "discount_percent": 15,
      "original_price": 1000.00,
      "amount_saved": 150.00,
      "discounted_price": 850.00
    }
  }
  ```

---

## 6. Loyalty Points System (Protected)

Active members earn reward points based on checkout order amounts.

### A. Get Current Points Balance
* **Route**: `GET /membership/points/balance`
* **Access**: User Protected
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Points balance fetched successfully",
    "data": {
      "points_balance": 1300
    }
  }
  ```

### B. Earn Points on Checkout (Internal / External checkout trigger)
* **Route**: `POST /membership/points/earn`
* **Access**: User Protected
* **Request Body**:
  ```json
  {
    "transaction_amount": 500.00
  }
  ```
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Earned 1000 points successfully from purchase",
    "data": {
      "points_earned": 1000
    }
  }
  ```

### C. Redeem Points for Checkout Discount
* **Route**: `POST /membership/points/redeem`
* **Access**: User Protected
* **Request Body**:
  ```json
  {
    "points": 500, // Points to redeem
    "order_amount": 200.00 // Current order total
  }
  ```
* **Conversion Rate**: `1 Point = 0.1 Currency Unit` (e.g., 500 points = $50 discount).
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Points redeemed against order successfully",
    "data": {
      "points_redeemed": 500,
      "discount_applied": 50.00,
      "final_price": 150.00
    }
  }
  ```

---

## 7. Admin Dashboard & Operations (Admin Only)

These endpoints require the bearer token of an Admin or Super Admin user.

### A. Get Dashboard Stats
* **Route**: `GET /membership/admin/stats`
* **Access**: Admin Protected
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Admin dashboard stats retrieved successfully",
    "data": {
      "total_members": 142,
      "active_plans_count": 3,
      "total_plans": 4,
      "total_revenue": 28400.50
    }
  }
  ```

### B. Get Subscribers list (Paginated & Filterable)
* **Route**: `GET /membership/admin/subscribers`
* **Access**: Admin Protected
* **Query Parameters** (Optional):
  * `page` (default: 1)
  * `limit` (default: 10)
  * `tier` (e.g. `silver`, `gold`, `platinum`)
  * `status` (e.g. `active`, `expired`, `cancelled`)
  * `search` (keyword matches name/email)
* **Sample Response**:
  ```json
  {
    "success": true,
    "message": "Subscribers list retrieved successfully",
    "data": [
      {
        "_id": "6a1149b22703a...",
        "user_id": {
          "_id": "6a1149b02703...",
          "firstName": "John",
          "lastName": "Doe",
          "email": "johndoe@example.com",
          "number": "9876543210",
          "name": "John Doe",
          "phone": "9876543210"
        },
        "plan_id": {
          "_id": "6a114a027fb...",
          "name": "Platinum Plan",
          "tier": "platinum"
        },
        "status": "active",
        "start_date": "2026-05-23T06:32:38.377Z",
        "expiry_date": "2026-08-23T06:32:38.377Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

### C. Get Revenue History Breakdown
* **Route**: `GET /membership/admin/revenue`
* **Access**: Admin Protected
* **Response `data` Description**: Monthly revenue split by tier for the last 12 months.

### D. Export Subscribers to CSV file
* **Route**: `GET /membership/admin/subscribers/export`
* **Access**: Admin Protected
* **Response Header**: `Content-Type: text/csv`
* **Action**: Directly downloads `subscribers.csv` containing fields: User Name, User Email, User Phone, Plan Name, Tier, Billing Cycle, Price, Status, Start Date, Expiry Date.
