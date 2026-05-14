import { handleApiRequest } from "../utils/apiResponse.js";
import TicketService from "../services/ticketServices.js";
import { ChatSocket } from "../Socket/chat.socket.js";

export default class TicketController {
  static async createTicket(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await TicketService.createTicket(req.user._id, req.body);
      return [{ data: result }, "Ticket created successfully", 201];
    });
  }

  static async getTicket(req, res) {
    return handleApiRequest(req, res, async () => {
      const isAdmin = req.user.role === "ADMIN";
      const result = await TicketService.getTicketById(req.params.id, req.user._id, isAdmin);
      return [{ data: result }, "Ticket fetched successfully"];
    });
  }

  static async getAllTickets(req, res) {
    return handleApiRequest(req, res, async () => {
      const isAdmin = req.user.role === "ADMIN";
      const result = await TicketService.getAllTickets(req.query, req.user._id, isAdmin);
      return [{ data: result }, "Tickets fetched successfully"];
    });
  }

  static async addMessage(req, res) {
    return handleApiRequest(req, res, async () => {
      const isAdmin = req.user.role === "ADMIN";
      const result = await TicketService.addMessage(req.params.id, req.user._id, req.body, isAdmin);
      return [{ data: result }, "Message added successfully"];
    });
  }

  static async updateTicketStatus(req, res) {
    return handleApiRequest(req, res, async () => {
      const result = await TicketService.updateTicketStatus(req.params.id, req.body.status);
      
      // Notify via Socket
      const io = req.app.get("io");
      if (io) {
        ChatSocket.notifyStatusUpdate(io, req.params.id, req.body.status, req.user._id);
      }

      return [{ data: result }, "Ticket status updated successfully"];
    });
  }

  static async deleteTicket(req, res) {
    return handleApiRequest(req, res, async () => {
      const isAdmin = req.user.role === "ADMIN";
      await TicketService.deleteTicket(req.params.id, req.user._id, isAdmin);
      return [{}, "Ticket deleted successfully"];
    });
  }
}