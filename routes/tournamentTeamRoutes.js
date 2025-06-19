import express from 'express';
import { 
    getTeamTournamentStats,
    updateTeamTournamentStatus,
    updateTournamentPlayerStatus,
} from '../controllers/tournamentTeamController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Register team in tournament
// router.post('/register', authMiddleware, registerTeamInTournament);

// Get team's tournament statistics
router.get('/:teamId/tournament/:tournamentId/stats', authMiddleware, getTeamTournamentStats);

// Update team's tournament status
router.patch('/:teamId/tournament/:tournamentId/status', authMiddleware, updateTeamTournamentStatus);

// Update tournament player status
router.patch('/:teamId/tournament/:tournamentId/player/:playerId/status', authMiddleware, updateTournamentPlayerStatus);

// Get player's tournaments
// router.get('/player/tournaments', authMiddleware, getPlayerTournaments);

export default router; 