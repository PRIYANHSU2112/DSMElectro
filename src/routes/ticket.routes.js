import { Router } from "express";
import TicketController from "../controllers/ticket.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

// Create a new ticket (Logged in user)
router.post("/ticket", authUser, TicketController.createTicket);

// Get all tickets (User sees their own, Admin sees all)
router.get("/tickets", authUser, TicketController.getAllTickets);

// Get specific ticket details
router.get("/ticket/:id", authUser, TicketController.getTicket);

// Add a message to a ticket
router.post("/ticket/:id/message", authUser, TicketController.addMessage);

// Update ticket status (Admin only)
router.patch("/ticket/:id/status", authUser, adminMiddleware, TicketController.updateTicketStatus);

// Delete a ticket
router.delete("/ticket/:id", authUser, TicketController.deleteTicket);

export default router;
