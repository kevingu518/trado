import express from 'express';
import analysisController from '../controller/analysisController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

router.get('/tearsheet', asyncHandler(analysisController.getTearsheet));

export default router;
