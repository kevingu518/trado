import express from 'express';
import aiAnalysisController from '../controller/aiAnalysisController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

router.get('/settings', asyncHandler(aiAnalysisController.getSettings));
router.put('/settings', asyncHandler(aiAnalysisController.updateSettings));
router.delete('/settings', asyncHandler(aiAnalysisController.clearSettings));
router.post('/test', asyncHandler(aiAnalysisController.test));
router.post('/analyze', asyncHandler(aiAnalysisController.analyze));

export default router;
