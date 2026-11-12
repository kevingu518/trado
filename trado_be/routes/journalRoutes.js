import express from 'express';
import journalController from '../controller/journalController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(journalController.list));
router.get('/context', asyncHandler(journalController.getContext));
router.put('/:date', asyncHandler(journalController.upsert));
router.delete('/:date', asyncHandler(journalController.remove));

export default router;
