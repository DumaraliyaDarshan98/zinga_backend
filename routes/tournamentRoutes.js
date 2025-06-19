import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    createTournament,
    joinTournament,
    updateMatchResult,
    getAllTournaments,
    getTournamentById,
    scheduleTournamentMatches,
    updateTournamentStatus,
    getMyTournaments,
    deleteTournament,
    getClubTournaments,
    getMyTeamBookings
} from '../controllers/tournamentController.js';

const router = express.Router();

// All routes are protected with authMiddleware
router.use(authMiddleware);

// Create tournament (admin only)
router.post('/', createTournament);

// Join tournament
router.post('/join', joinTournament);

// Update match result
router.post('/match/result', updateMatchResult);

// Get all tournaments
router.get('/', getAllTournaments);

// Get club tournaments
router.get('/club/tournaments', getClubTournaments);

// Get tournament by ID
router.get('/:id', getTournamentById);

router.delete('/:tournamentId', deleteTournament);

// Schedule tournament matches
router.post('/:tournamentId/schedule', scheduleTournamentMatches);

// Update tournament status
router.patch('/:tournamentId/status', updateTournamentStatus);

// Get user's tournaments
router.get('/my/tournaments/:tournamentId', getMyTournaments);

// Get team's ground booking history
router.get('/my/bookings', getMyTeamBookings);

export default router; 