import TicketService from "../services/ticketServices.js";
import jwt from "jsonwebtoken";
import userModel from "../model/user.model.js";

const JWT_SECRET = process.env.HASH_KEY || "secret123";

export class ChatSocket {
  constructor(io) {
    this.io = io;
    this.init();
  }

  init() {
    // Auth Middleware for Socket
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.token;
      if (!token) return next(new Error("Authentication error: No token provided"));

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Populate user with role to check permissions
        const user = await userModel.findById(decoded.id).populate("role");
        if (!user) return next(new Error("Authentication error: User not found"));
        
        socket.user = user; 
        next();
      } catch (err) {
        next(new Error("Authentication error: Invalid token"));
      }
    });

    this.io.on("connection",  (socket) => {
      console.log(`User connected: ${socket.user.id} (${socket.id})`);

      // Room join by ticket Id
      socket.on("joinTicket", async ({ ticketId }) => {
        socket.join(ticketId);
        console.log(`Socket ${socket.id} joined ticket ${ticketId}`);

        try {
            const isAdmin = socket.user.role?.name === "Super Admin" || 
                           socket.user.role?.permissions?.includes("tickets.manage");
            const ticket = await TicketService.getTicketById(ticketId, socket.user.id, isAdmin);
            
            socket.emit("chat:chatHistory",{
                messages:ticket.messages,
                status:ticket.status
            })
        } catch (error) {
            console.error("Socket joinTicket error:", error);
            socket.emit("socketError",{message:error.message || "Failed to load chat history"});
        }
      });

      socket.on("chat:sendMessage", async ({ ticketId, text, senderRole }) => {
        try {
          // senderRole should be "ADMIN" or "USER"
          const isAdmin = socket.user.role?.name === "Super Admin" || 
                         socket.user.role?.permissions?.includes("tickets.manage");
          
          await TicketService.addMessage(
            ticketId,
            socket.user.id,
            { text },
            isAdmin
          );

          // Broadcast to everyone in the room
          this.io.to(ticketId).emit("chat:newMessage", {
            sender: isAdmin ? "ADMIN" : "USER",
            text,
            time: new Date().toISOString(),
            ticketId,
          });
        } catch (error) {
          socket.emit("error", { message: error.message });
        }
      });

      // Typing indicator
      socket.on("chat:typing", ({ ticketId, senderName }) => {
        socket.to(ticketId).emit("chat:typing", { senderName });
      });

      socket.on("chat:stopTyping", ({ ticketId }) => {
        socket.to(ticketId).emit("chat:stopTyping", { ticketId });
      });

      socket.on("leaveTicket", ({ ticketId }) => {
        socket.leave(ticketId);
        console.log(`Socket ${socket.id} left ticket ${ticketId}`);
      });

      socket.on("disconnect", () => {
        console.log(`Socket ${socket.id} disconnected`);
      });
    });
  }

  static notifyStatusUpdate(io, ticketId, newStatus, userId) {
    io.to(ticketId).emit("statusUpdate", {
      ticketId,
      newStatus,
      updatedAt: new Date(),
      updatedBy: userId,
    });
  }
}