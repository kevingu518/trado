import request from './request';

/**
 * 持股族群相關 API
 */

// Categories CRUD
export const getStockCategoriesApi = () => request.get('/stock-categories');
export const createStockCategoryApi = (data) => request.post('/stock-categories', data);
export const bulkCreateStockCategoriesApi = (items) =>
  request.post('/stock-categories/bulk', { items });
export const updateStockCategoryApi = (id, data) => request.put(`/stock-categories/${id}`, data);
export const deleteStockCategoryApi = (id) => request.delete(`/stock-categories/${id}`);

// Allocation analytics
export const getStockCategoryAllocationApi = () => request.get('/stock-categories/allocation');

// Symbol ↔ Category mappings
export const getStockCategoryMappingsApi = () => request.get('/stock-categories/mappings');
export const setSymbolCategoryApi = (symbol, categoryId) =>
  request.put(`/stock-categories/symbols/${encodeURIComponent(symbol)}`, { categoryId });
export const bulkSetSymbolCategoryApi = (symbols, categoryId) =>
  request.post('/stock-categories/symbols/bulk', { symbols, categoryId });
