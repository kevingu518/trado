import express from 'express';
import accountController from '../controller/accountController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

router.get('/balance', asyncHandler(accountController.getBalance));
router.post('/deposit', asyncHandler(accountController.deposit));
router.post('/withdraw', asyncHandler(accountController.withdraw));
router.get('/balance/history', asyncHandler(accountController.getBalanceHistory));
router.get('/trade-settings', asyncHandler(accountController.getTradeSettings));
router.put('/trade-settings', asyncHandler(accountController.updateTradeSettings));
router.put('/cash-balance', asyncHandler(accountController.setCashBalance));

export default router;
