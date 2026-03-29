import express from 'express';
import healthController from '../controller/healthController.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.get('/', asyncHandler(healthController.check));

export default router;
