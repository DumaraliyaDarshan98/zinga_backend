import express from 'express';
import { loginUser, registerUser, resetPassword, updateUser, memberRegister, memberList, approveUser, deleteUser, getUsers, mobileloginUser, returnUserId, getUserProfile } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const userRouter = express.Router();

userRouter.post('/auth', loginUser);
userRouter.post('/auth/mobile', mobileloginUser);
userRouter.post('/register', registerUser);
userRouter.post('/reset-password', authMiddleware, resetPassword);
userRouter.post('/member-check', authMiddleware, returnUserId);
userRouter.put('/update', authMiddleware, updateUser);
userRouter.put('/update/:id', authMiddleware, approveUser);
userRouter.delete('/delete/:id', authMiddleware, deleteUser);

userRouter.post('/member', authMiddleware, memberRegister);
userRouter.get('/member', authMiddleware, memberList);

// Route to get authenticated user's profile
userRouter.get('/profile', authMiddleware, getUserProfile);

// New route for getting users with filters
userRouter.get('/', authMiddleware, getUsers);

export default userRouter;
