import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    createReport,
    getAllReports,
} from '../controllers/reportController.js';

const router = express.Router();

// All routes are protected with authMiddleware
router.use(authMiddleware);

// Create a new report
router.post('/', createReport);

// Get all reports (admin only)
router.get('/', getAllReports);


export default router; 