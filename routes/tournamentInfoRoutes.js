import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    // FAQ Controllers
    createTournamentFAQ,
    getTournamentFAQByTournamentId,
    updateTournamentFAQ,
    deleteTournamentFAQ,
    
    // Rules Controllers
    createTournamentRules,
    getTournamentRulesByTournamentId,
    updateTournamentRules,
    deleteTournamentRules,
    
    // Guidelines Controllers
    createTournamentGuidelines,
    getTournamentGuidelinesByTournamentId,
    updateTournamentGuidelines,
    deleteTournamentGuidelines
} from '../controllers/tournamentInfoController.js';

const router = express.Router();

// All routes are protected with authMiddleware
router.use(authMiddleware);

// FAQ Routes
router.post('/faq', createTournamentFAQ);
router.get('/faq/:tournamentId', getTournamentFAQByTournamentId);
router.put('/faq/:tournamentId', updateTournamentFAQ);
router.delete('/faq/:tournamentId', deleteTournamentFAQ);

// Rules Routes
router.post('/rules', createTournamentRules);
router.get('/rules/:tournamentId', getTournamentRulesByTournamentId);
router.put('/rules/:tournamentId', updateTournamentRules);
router.delete('/rules/:tournamentId', deleteTournamentRules);

// Guidelines Routes
router.post('/guidelines', createTournamentGuidelines);
router.get('/guidelines/:tournamentId', getTournamentGuidelinesByTournamentId);
router.put('/guidelines/:tournamentId', updateTournamentGuidelines);
router.delete('/guidelines/:tournamentId', deleteTournamentGuidelines);

export default router; 