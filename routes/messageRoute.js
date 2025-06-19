import express from "express";
import {
    createMessage,
    getMessagesByClub,
    updateMessage,
    deleteMessage
} from "../controllers/messageController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, createMessage);
router.get("/:clubId", getMessagesByClub);
router.put("/:id", authMiddleware, updateMessage);
router.delete("/:id", authMiddleware, deleteMessage);

export default router;
