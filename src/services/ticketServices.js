import ticketModel from "../model/ticket.model.js";
import { AppError } from "../utils/apiResponse.js";

export default class TicketService {
  static async createTicket(userId, payload) {
    const ticket = await ticketModel.create({
      userId,
      ...payload,
    });
    return ticket;
  }

  static async getTicketById(ticketId, userId, isAdmin = false) {
    const ticket = await ticketModel.findById(ticketId).populate("userId", "firstName lastName email");
    if (!ticket) throw new AppError("Ticket not found", 404);

    // If not admin, check if the ticket belongs to the user
    if (!isAdmin && ticket.userId._id.toString() !== userId.toString()) {
      throw new AppError("Unauthorized access to ticket", 403);
    }

    return ticket;
  }

  static async getAllTickets(query, userId, isAdmin = false) {
    const { status, category, page = 1, limit = 10 } = query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const match = {};
    if (!isAdmin) {
      match.userId = userId;
    }
    if (status) match.status = status;
    if (category) match.category = category;

    const [tickets, total] = await Promise.all([
      ticketModel.find(match).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate("userId", "firstName lastName email"),
      ticketModel.countDocuments(match),
    ]);

    return {
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  static async addMessage(ticketId, userId, payload, isAdmin = false) {
    const ticket = await ticketModel.findById(ticketId);
    if (!ticket) throw new AppError("Ticket not found", 404);

    if (!isAdmin && ticket.userId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized access to ticket", 403);
    }

    ticket.messages.push({
      sender: isAdmin ? "ADMIN" : "USER",
      text: payload.text,
      time: new Date(),
    });

    if (payload.status) {
      ticket.status = payload.status;
    }

    await ticket.save();
    return ticket;
  }

  static async updateTicketStatus(ticketId, status) {
    const ticket = await ticketModel.findByIdAndUpdate(
      ticketId,
      { $set: { status } },
      { new: true }
    );
    if (!ticket) throw new AppError("Ticket not found", 404);
    return ticket;
  }

  static async deleteTicket(ticketId, userId, isAdmin = false) {
    const ticket = await ticketModel.findById(ticketId);
    if (!ticket) throw new AppError("Ticket not found", 404);

    if (!isAdmin && ticket.userId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized access to ticket", 403);
    }

    await ticket.deleteOne();
    return true;
  }
}
