import express from 'express';
import riskController from '../controller/riskController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

router.get('/alerts', asyncHandler(riskController.getAlerts));
router.get('/exposure', asyncHandler(riskController.getExposure));
router.post('/alerts/ack', asyncHandler(riskController.ackAlert));
router.delete('/alerts/ack', asyncHandler(riskController.unackAlert));
router.post('/alerts/ack-all', asyncHandler(riskController.ackAll));

export default router;
