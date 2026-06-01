import express from 'express';
import stockCategoryController from '../controller/stockCategoryController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

router.use(authenticate);

// Categories CRUD
router.get('/', asyncHandler(stockCategoryController.listCategories));
router.post('/', asyncHandler(stockCategoryController.createCategory));
router.post('/bulk', asyncHandler(stockCategoryController.bulkCreateCategories));
router.put('/:id', asyncHandler(stockCategoryController.updateCategory));
router.delete('/:id', asyncHandler(stockCategoryController.deleteCategory));

// Allocation analytics
router.get('/allocation', asyncHandler(stockCategoryController.getAllocation));

// Symbol ↔ Category mappings
router.get('/mappings', asyncHandler(stockCategoryController.listMappings));
router.put('/symbols/:symbol', asyncHandler(stockCategoryController.setSymbolCategory));
router.post('/symbols/bulk', asyncHandler(stockCategoryController.bulkSetSymbolCategory));

export default router;
