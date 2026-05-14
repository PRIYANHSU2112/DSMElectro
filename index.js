import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import logger from "./src/utils/logger.js";
import DB from "./src/config/database.js";
import "./src/utils/cron.js";
import { connectRedis } from "./src/config/redis.js"; 
import {Server} from "socket.io";
import { ChatSocket } from "./src/Socket/chat.socket.js";

const startServer = async () => {
  await DB();
  try {
    await connectRedis();
  } catch (error) {
    logger.warn("Redis could not be connected. Proceeding without Redis.");
  }
  
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  app.set("io", io);
  new ChatSocket(io);
};

startServer();
