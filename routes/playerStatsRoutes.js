import express from 'express';
import {
    getPlayerStats,
    getPlayerStatsByBallType,
    getPlayerMatchHistory,
    getTeamLeaderboard
} from '../controllers/playerStatsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Get player statistics
router.get('/player/:playerId', authMiddleware, getPlayerStats);

// Get player statistics by ball type
router.get('/player/:playerId/ball-type/:ballType', authMiddleware, getPlayerStatsByBallType);

// Get player match history
router.get('/player/:playerId/matches', authMiddleware, getPlayerMatchHistory);

// Get team leaderboard
router.get('/team/:teamId/leaderboard', authMiddleware, getTeamLeaderboard);

export default router; 