import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    createCommentReport,
    getAllCommentReports,
} from '../controllers/commentReportController.js';

const router = express.Router();

// All routes are protected with authMiddleware
router.use(authMiddleware);

// Create a new comment report
router.post('/posts/:postId/comments/:commentId/report', createCommentReport);

// Get all comment reports (admin only)
router.get('/', getAllCommentReports);


export default router; 