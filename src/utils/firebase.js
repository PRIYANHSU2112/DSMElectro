import admin from "firebase-admin";
import serviceAccount from "../config/serviceAccount.json" with { type: "json" };

let firebaseAdmin;

try {
  // Verify if private key is a placeholder or not provided
  const isPlaceholder = !serviceAccount.private_key || 
                        serviceAccount.private_key.includes("...") ||
                        serviceAccount.private_key.includes("unique-key-id") ||
                        serviceAccount.project_id === "new-project-id";

  if (isPlaceholder) {
    throw new Error("Private key is a placeholder or not configured in serviceAccount.json.");
  }

  const formattedPrivateKey = serviceAccount.private_key.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      ...serviceAccount,
      private_key: formattedPrivateKey
    }),
  });

  firebaseAdmin = admin;
  console.log("🚀 Firebase Admin successfully initialized!");
} catch (error) {
  console.warn("\n⚠️  [Firebase Warning] Firebase Admin initialization failed/skipped:");
  console.warn(`   Reason: ${error.message}`);
  console.warn("   In-app notifications will still be saved to the database,");
  console.warn("   and outgoing FCM push notifications will be safely simulated.\n");

  // Create a robust mock object so the API server runs perfectly without crashing
  firebaseAdmin = {
    messaging: () => ({
      sendEachForMulticast: async (payload) => {
        console.log("📲 [FCM Simulated Push] Multicast payload:", JSON.stringify(payload, null, 2));
        return {
          successCount: payload.tokens ? payload.tokens.length : 0,
          failureCount: 0,
          responses: (payload.tokens || []).map(() => ({
            success: true,
            messageId: `simulated-fcm-${Math.random().toString(36).substring(2, 9)}`,
          })),
        };
      },
      send: async (payload) => {
        console.log("📲 [FCM Simulated Push] Single payload:", JSON.stringify(payload, null, 2));
        return `simulated-fcm-${Math.random().toString(36).substring(2, 9)}`;
      }
    })
  };
}

export default firebaseAdmin;