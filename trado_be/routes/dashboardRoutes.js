import express from 'express';
import dashboardController from '../controller/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(dashboardController.getDashboard));

export default router;
