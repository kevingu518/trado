import express from 'express';
import devController from '../controller/devController.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

// 開發用：生成假資料
router.post('/seed', asyncHandler(devController.generateSeedData));

export default router;
