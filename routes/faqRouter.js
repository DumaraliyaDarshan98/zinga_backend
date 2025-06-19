import express from 'express';
import { 
    createSection, 
    addQuestion, 
    updateQuestion, 
    deleteQuestion, 
    getAllSections 
} from '../controllers/faqController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const faqRouter = express.Router();

faqRouter.post('/section', authMiddleware, createSection);
faqRouter.post('/section/:id/question', authMiddleware, addQuestion);
faqRouter.put('/section/:sectionId/question/:questionId', authMiddleware, updateQuestion);
faqRouter.delete('/section/:sectionId/question/:questionId', authMiddleware, deleteQuestion);
faqRouter.get('/sections', getAllSections);

export default faqRouter;
