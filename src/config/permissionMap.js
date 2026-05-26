/**
 * Centralized Permission Map
 * Format: 
 * "exact_path": { "METHOD": "permission.name" }
 * 
 * For paths with parameters (like /product/:id), use the Express route string.
 */
export const PERMISSION_MAP = {
  // Products
  "/api/v1/create/product": { POST: "products.edit" },
  "/api/v1/product/:id": { PUT: "products.edit", DELETE: "products.edit" },
  "/api/v1/product/:id/trending": { PATCH: "products.edit" },
  "/api/v1/products/admin": { GET: "products.view" },
  
  // Orders
  "/api/v1/orders": { GET: "orders.view" },
  "/api/v1/order/:id": { PUT: "orders.edit" },

  // Users & Roles
  "/api/v1/roles": { GET: "users.manage", POST: "users.manage" },
  "/api/v1/auth/admin/create": { POST: "users.manage" },
  "/api/v1/permissions": { GET: "users.manage" },
  
  // Affiliates
  "/api/v1/affiliates": { GET: "affiliates.view" },
  
  // Settings & Content
  "/api/v1/settings": { PATCH: "settings.manage" },
  "/api/v1/content": { POST: "content.manage" },

  // Tickets
  "/api/v1/ticket/:id/status": { PATCH: "tickets.manage" },
  "/api/v1/ticket/:id/message": { POST: "tickets.manage" },
  // Invoices
  "/api/v1/invoice/:id": { PATCH: "orders.edit" },

  // Flash Sale
  "/api/v1/flash-sale/:id": { PATCH: "products.edit" },
  "/api/v1/flash-sale/:id/add-items": { PATCH: "products.edit" },
};
