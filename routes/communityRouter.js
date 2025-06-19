import express from 'express';
import {
    createPost,
    likePost,
    commentPost,
    getAllPosts,
    deletePost,
    updatePost
} from '../controllers/communityController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const communityRouter = express.Router();

communityRouter.post('/', authMiddleware, createPost);
communityRouter.put('/:id', authMiddleware, updatePost);
communityRouter.put('/:id/like', authMiddleware, likePost);
communityRouter.post('/:id/comment', authMiddleware, commentPost);
communityRouter.get('/', authMiddleware, getAllPosts);
communityRouter.delete('/:id', authMiddleware, deletePost);


export default communityRouter;
