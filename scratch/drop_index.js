import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const dropReferralIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/test");
    console.log("Connected to MongoDB");

    const collection = mongoose.connection.collection("users");
    
    const indexes = await collection.indexes();
    console.log("Current indexes on 'users' collection:");
    console.log(indexes.map(idx => idx.name));
    
    try {
      await collection.dropIndex("referralCode_1");
      console.log("Successfully dropped 'referralCode_1' index from users collection.");
    } catch (err) {
      if (err.codeName === "IndexNotFound") {
        console.log("Index 'referralCode_1' not found, it might have been dropped already.");
      } else {
        throw err;
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error dropping index:", error);
    process.exit(1);
  }
};

dropReferralIndex();
