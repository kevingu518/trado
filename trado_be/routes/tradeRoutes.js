import express from 'express';
import tradeController from '../controller/tradeController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

// 所有 trade 路由都需要認證
router.use(authenticate);

// Trade routes - 使用 asyncHandler 包裝，不需要 .bind()
router.get('/', asyncHandler(tradeController.getAllTrades));
router.post('/', asyncHandler(tradeController.createTrade));

// Position routes (必須在 /:id 之前，避免路由衝突)
router.get('/:id/positions', asyncHandler(tradeController.getPositions));
router.post('/:id/positions', asyncHandler(tradeController.createPosition));
router.put('/:id/positions/:positionId', asyncHandler(tradeController.updatePosition));
router.delete('/:id/positions/:positionId', asyncHandler(tradeController.deletePosition));

// Trade detail routes
router.get('/:id', asyncHandler(tradeController.getTradeById));
router.put('/:id', asyncHandler(tradeController.updateTrade));
router.delete('/:id', asyncHandler(tradeController.deleteTrade));

export default router;
