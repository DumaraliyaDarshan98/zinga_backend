import express from 'express';
import userRouter from './userRoutes.js';
import groundRoutes from './groundRouters.js';
import faqRouter from './faqRouter.js';
import communityRouter from './communityRouter.js';
import clubRoutes from "./clubRoutes.js";
import messageRoutes from "./messageRoute.js"
import teamRouter from "./teamRouter.js"
import tournamentRouter from "./tournamentRoutes.js"
import tournamentInfoRouter from "./tournamentInfoRoutes.js"
import reportRoutes from './reportRoutes.js';
import commentReportRoutes from './commentReportRoutes.js';
import matchRoutes from './matchRoutes.js';
import playerStatsRoutes from './playerStatsRoutes.js';
import tournamentStatsRoutes from './tournamentStatsRoutes.js';
import tournamentTeamRoutes from './tournamentTeamRoutes.js';

const router = express.Router();

router.use('/user', userRouter);
router.use('/faq', faqRouter);
router.use('/post', communityRouter);
router.use("/clubs", clubRoutes);
router.use("/message", messageRoutes);
router.use('/ground', groundRoutes);
router.use('/team', teamRouter);
router.use('/tournament', tournamentRouter);
router.use('/tournament-info', tournamentInfoRouter);
router.use('/reports', reportRoutes);
router.use('/comment-reports', commentReportRoutes);
router.use('/match', matchRoutes);
router.use('/stats', playerStatsRoutes);
router.use('/tournament-stats', tournamentStatsRoutes);
router.use('/tournament-teams', tournamentTeamRoutes);

export default router;