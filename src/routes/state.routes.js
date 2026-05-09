import express from "express";
import StateController from "../controllers/state.controller.js";
import { authUser, adminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// CREATE
router.post(
  "/state",
  authUser,
  adminMiddleware,
  StateController.createState
);


// UPDATE
router.put(
  "/state/:id",
  authUser,
  adminMiddleware,
  StateController.updateState
);

// DELETE
router.delete(
  "/state/:id",
  authUser,
  adminMiddleware,
  StateController.deleteState
);

// TOGGLE 
router.patch(
  "/state/:id/toggle",
  authUser,
  adminMiddleware,
  StateController.toggleStateStatus
);

// GET ALL
router.get(
  "/states",
  authUser,
  StateController.getAllStates
);

// GET BY ID
router.get(
  "/state/:id",
  authUser,
  StateController.getStateById
);

export default router;