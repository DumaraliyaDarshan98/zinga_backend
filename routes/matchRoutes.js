import express from "express";
import {
  getMatchById,
  updateMatchStatus,
  updateToss,
  updateCurrentPlayers,
  addBall,
  getMatchHighlights,
  getMyUmpireMatches,
  undoBall,
  getBattingStatus,
  updateBall
} from "../controllers/matchController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get matches where the authenticated user is an umpire
router.get("/umpire/my-matches", authMiddleware, getMyUmpireMatches);

// Get match details
router.get("/:matchId", authMiddleware, getMatchById);

// Update match status
router.patch("/:matchId/status", authMiddleware, updateMatchStatus);

// Update toss information
router.patch("/:matchId/toss", authMiddleware, updateToss);

// Update current players
router.patch("/:matchId/players", authMiddleware, updateCurrentPlayers);

// Add ball-by-ball scoring
router.post("/:matchId/ball", authMiddleware, addBall);

// Undo ball-by-ball scoring
router.post("/:matchId/undo-ball", authMiddleware, undoBall);

// Get match highlights
router.get("/:matchId/highlights", authMiddleware, getMatchHighlights);

// Get batting status for an innings
router.get("/:matchId/batting-status", authMiddleware, getBattingStatus);

// API to be used for the update ball details and update the innings total runs based on the negative run and bonus runs
router.patch("/:matchId/update-ball/:ballId", authMiddleware, updateBall);

export default router;
