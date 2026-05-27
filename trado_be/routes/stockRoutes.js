import express from 'express';
import stockController from '../controller/stockController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

router.get('/prices', asyncHandler(stockController.getLatestPrices));
router.get('/:symbol/kline', asyncHandler(stockController.getKline));

export default router;
