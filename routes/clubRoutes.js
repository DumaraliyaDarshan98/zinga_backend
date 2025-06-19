import express from "express";
import {
    createClub,
    getClubDetails,
    joinClub,
    getAllClubs,
    leaveClub,
    updateClub,
    requestProcessClub,
    applyForCaptain,
    voteForCaptain,
    approveCaptain,
    removeCaptain,
    clubJoinTournament,
    memberJoinTournament
} from "../controllers/clubController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", authMiddleware, createClub);
router.post("/join", authMiddleware, joinClub);
router.post("/leave", authMiddleware, leaveClub);

router.post('/caption/apply/:clubId', authMiddleware, applyForCaptain)
router.post('/caption/vote', authMiddleware, voteForCaptain)
router.post('/caption/verify', authMiddleware, approveCaptain)
router.post('/caption/remove/:userId', authMiddleware, removeCaptain)

router.put("/update/:clubId", authMiddleware, updateClub);
router.put("/request-process/:id", authMiddleware, requestProcessClub);

router.get("/", authMiddleware, getAllClubs);
router.get("/:id", authMiddleware, getClubDetails);

// Tournament routes
router.post("/join-tournament", authMiddleware, clubJoinTournament);
router.post("/member-join-tournament", authMiddleware, memberJoinTournament);

export default router;
