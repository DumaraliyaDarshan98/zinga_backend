import express from 'express';
import {
    createGround,
    getAllGrounds,
    getGroundById,
    updateGround,
    deleteGround,
    groundDashboardStaff,
    groundCompletedStaff,
    updateSlotsTournamentStatus,
    getGroundActivities,
    updateSlotPrice,
    getGroundOwnerActivities
} from '../controllers/groundController.js';
import { authMiddleware, isGroundStaff } from '../middlewares/authMiddleware.js';
import { groundBooking, groundBookingHistory, getMyBooking, groundBookingUmpireHistory } from '../controllers/groundBookingController.js';
import {
    createPriceEntry,
} from '../controllers/priceManagementController.js';

const router = express.Router();

router.get('/', authMiddleware, getAllGrounds);
router.get('/:id', authMiddleware, getGroundById);
router.get('/dashboard/ground-staff', authMiddleware, groundDashboardStaff)
router.get('/completed/ground-staff', authMiddleware, groundCompletedStaff)
router.get('/booking/history', authMiddleware, groundBookingHistory)
router.get('/booking/umpire/history', authMiddleware, groundBookingUmpireHistory)
router.post('/booking', authMiddleware, groundBooking)
router.put('/:id', authMiddleware, updateGround);
router.patch('/slots/tournament-status', authMiddleware, updateSlotsTournamentStatus);
router.patch('/slots/price', authMiddleware, updateSlotPrice);
router.get('/:groundId/activities', authMiddleware, getGroundActivities);
router.get('/my/booking', authMiddleware, getMyBooking);
router.get('/owner/owner-activities', authMiddleware, getGroundOwnerActivities);

// Price management routes
router.post('/pricing', authMiddleware, createPriceEntry);

router.delete('/:id', authMiddleware, isGroundStaff, deleteGround);
router.post('/', authMiddleware, isGroundStaff, createGround);


export default router;
