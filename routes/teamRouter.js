import express from 'express';
import {
    createTeam,
    updateTeam,
    playerAction,
    getTeams
} from '../controllers/teamController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const teamRouter = express.Router();

teamRouter.post('/', authMiddleware, createTeam);
teamRouter.put('/:id', authMiddleware, updateTeam);
teamRouter.patch('/:id/:userId', authMiddleware, playerAction);
teamRouter.get('/', authMiddleware, getTeams);


export default teamRouter;
