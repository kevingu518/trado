import {
  getStockCategoriesApi,
  createStockCategoryApi,
  bulkCreateStockCategoriesApi,
  updateStockCategoryApi,
  deleteStockCategoryApi,
  getStockCategoryAllocationApi,
  getStockCategoryMappingsApi,
  setSymbolCategoryApi,
  bulkSetSymbolCategoryApi,
} from '@api/api_stockCategory';

/**
 * Stock Category Service
 * Component ➜ Service ➜ API ➜ request.js
 */

const toFrontend = (c) => {
  if (!c) return null;
  return {
    id: c.id,
    userId: c.userId,
    name: c.name || '',
    color: c.color || 'blue',
    // 後端為 0.0~1.0 小數，前端統一保留小數（顯示時 *100）
    targetRatio: c.targetRatio === null || c.targetRatio === undefined ? null : parseFloat(c.targetRatio),
    sortOrder: c.sortOrder ?? 0,
    symbolCount: c._count?.mappings ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

const toAPI = (data) => ({
  ...(data.name !== undefined && { name: data.name }),
  ...(data.color !== undefined && { color: data.color }),
  ...(data.targetRatio !== undefined && { targetRatio: data.targetRatio }),
  ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
});

export const stockCategoriesService = {
  async fetchCategories() {
    const res = await getStockCategoriesApi();
    const list = Array.isArray(res) ? res : (res?.data ?? []);
    return list.map(toFrontend);
  },

  async addCategory(payload) {
    const res = await createStockCategoryApi(toAPI(payload));
    return toFrontend(res);
  },

  async bulkAddCategories(items) {
    // items: [{ name, color, targetRatio? }]
    const apiItems = items.map(toAPI);
    const res = await bulkCreateStockCategoriesApi(apiItems);
    const list = Array.isArray(res) ? res : (res?.data ?? []);
    return list.map(toFrontend);
  },

  async editCategory(id, payload) {
    const res = await updateStockCategoryApi(id, toAPI(payload));
    return toFrontend(res);
  },

  async removeCategory(id) {
    return await deleteStockCategoryApi(id);
  },

  async fetchMappings() {
    const res = await getStockCategoryMappingsApi();
    const list = Array.isArray(res) ? res : (res?.data ?? []);
    // 回傳 { symbol -> categoryId } 方便表格 lookup
    const map = {};
    for (const row of list) {
      map[row.symbol] = row.categoryId;
    }
    return map;
  },

  async fetchAllocation() {
    const res = await getStockCategoryAllocationApi();
    return res?.data ?? res;
  },

  async setSymbolCategory(symbol, categoryId) {
    return await setSymbolCategoryApi(symbol, categoryId);
  },

  async bulkSetSymbolCategory(symbols, categoryId) {
    return await bulkSetSymbolCategoryApi(symbols, categoryId);
  },
};

export default stockCategoriesService;
