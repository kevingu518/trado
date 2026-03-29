import express from 'express';
import strategyController from '../controller/strategyController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

// 所有 strategy 路由都需要認證
router.use(authenticate);

// Strategy routes - 使用 asyncHandler 包裝，不需要 .bind()
router.get('/', asyncHandler(strategyController.getAllStrategies));
router.post('/', asyncHandler(strategyController.createStrategy));
router.get('/:id', asyncHandler(strategyController.getStrategyById));
router.put('/:id', asyncHandler(strategyController.updateStrategy));
router.delete('/:id', asyncHandler(strategyController.deleteStrategy));

// 績效相關路由
router.get('/:id/performance', asyncHandler(strategyController.getCurrentPerformance));
router.post('/:id/performance/recalculate', asyncHandler(strategyController.recalculatePerformance));
router.put('/:id/performance', asyncHandler(strategyController.updatePerformanceManually));
router.get('/:id/snapshots', asyncHandler(strategyController.getSnapshots));
router.post('/:id/snapshots', asyncHandler(strategyController.createPeriodSnapshot));

export default router;
