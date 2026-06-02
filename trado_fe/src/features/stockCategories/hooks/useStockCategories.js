import { useState, useEffect, useCallback } from 'react';
import { to } from 'await-to-js';
import { stockCategoriesService } from '../services/stockCategories';
import { MAX_CATEGORIES } from '../config';

export const useStockCategories = (enabled = true) => {
  const [list, setList] = useState([]);
  const [mappings, setMappings] = useState({}); // { [symbol]: categoryId }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mutating, setMutating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [err, [categories, mapData]] = await to(
      Promise.all([
        stockCategoriesService.fetchCategories(),
        stockCategoriesService.fetchMappings(),
      ]),
    );
    if (err) {
      setError(err);
    } else {
      setList(categories || []);
      setMappings(mapData || {});
    }
    setLoading(false);
    return { err };
  }, []);

  useEffect(() => {
    if (enabled) fetchAll();
  }, [enabled, fetchAll]);

  const createCategory = useCallback(async (payload) => {
    setMutating(true);
    const [err, result] = await to(stockCategoriesService.addCategory(payload));
    setMutating(false);
    if (!err) await fetchAll();
    return { err, result };
  }, [fetchAll]);

  const bulkCreateCategories = useCallback(async (items) => {
    setMutating(true);
    const [err, result] = await to(stockCategoriesService.bulkAddCategories(items));
    setMutating(false);
    if (!err) await fetchAll();
    return { err, result };
  }, [fetchAll]);

  // Optimistic 拖曳排序：傳兩個 pool 的 id 順序；失敗自動 refetch 回滾
  const reorderCategories = useCallback(async (activeIds, standbyIds) => {
    const prev = list;
    const idToCat = new Map(list.map((c) => [c.id, c]));
    const merged = [
      ...activeIds.map((id) => {
        const c = idToCat.get(id);
        return c ? { ...c, isStandby: false } : null;
      }).filter(Boolean),
      ...standbyIds.map((id) => {
        const c = idToCat.get(id);
        return c ? { ...c, isStandby: true } : null;
      }).filter(Boolean),
    ];
    setList(merged);
    const [err, result] = await to(stockCategoriesService.reorderCategories(activeIds, standbyIds));
    if (err) {
      setList(prev);
      await fetchAll();
      return { err };
    }
    if (Array.isArray(result)) setList(result);
    return { err: null, result };
  }, [list, fetchAll]);

  const updateCategory = useCallback(async (id, payload) => {
    setMutating(true);
    const [err, result] = await to(stockCategoriesService.editCategory(id, payload));
    setMutating(false);
    if (!err) await fetchAll();
    return { err, result };
  }, [fetchAll]);

  const deleteCategory = useCallback(async (id) => {
    setMutating(true);
    const [err, result] = await to(stockCategoriesService.removeCategory(id));
    setMutating(false);
    if (!err) await fetchAll();
    return { err, result };
  }, [fetchAll]);

  const setSymbolCategory = useCallback(async (symbol, categoryId) => {
    const [err, result] = await to(
      stockCategoriesService.setSymbolCategory(symbol, categoryId),
    );
    if (!err) {
      setMappings((prev) => {
        const next = { ...prev };
        if (!categoryId) delete next[symbol];
        else next[symbol] = categoryId;
        return next;
      });
    }
    return { err, result };
  }, []);

  const bulkSetSymbolCategory = useCallback(async (symbols, categoryId) => {
    const [err, result] = await to(
      stockCategoriesService.bulkSetSymbolCategory(symbols, categoryId),
    );
    if (!err) {
      setMappings((prev) => {
        const next = { ...prev };
        for (const s of symbols) {
          if (!categoryId) delete next[s];
          else next[s] = categoryId;
        }
        return next;
      });
    }
    return { err, result };
  }, []);

  return {
    list,
    mappings,
    loading,
    error,
    mutating,
    refetch: fetchAll,
    createCategory,
    bulkCreateCategories,
    reorderCategories,
    updateCategory,
    deleteCategory,
    setSymbolCategory,
    bulkSetSymbolCategory,
    isAtLimit: list.length >= MAX_CATEGORIES,
    maxCategories: MAX_CATEGORIES,
  };
};

export default useStockCategories;
