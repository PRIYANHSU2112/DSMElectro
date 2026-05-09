import dotenv from "dotenv";
import app from "./src/app.js";
import logger from "./src/utils/logger.js";
import DB from "./src/config/database.js";
import "./src/utils/cron.js";
import { connectRedis } from "./src/config/redis.js"; 

dotenv.config();

const startServer = async () => {
  await DB();
  try {
    await connectRedis();
  } catch (error) {
    logger.warn("Redis could not be connected. Proceeding without Redis.");
  }
  
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

startServer();

