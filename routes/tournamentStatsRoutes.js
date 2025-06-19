import express from 'express';
import { getTournamentPointTable, getTournamentStats } from '../controllers/tournamentStatsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Get tournament point table
router.get('/:tournamentId/point-table', authMiddleware, getTournamentPointTable);

// Get comprehensive tournament statistics
router.get('/:tournamentId/stats', authMiddleware, getTournamentStats);

export default router; 