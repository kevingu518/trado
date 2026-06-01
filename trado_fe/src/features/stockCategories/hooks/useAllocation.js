import { useState, useEffect, useCallback } from 'react';
import { to } from 'await-to-js';
import { stockCategoriesService } from '../services/stockCategories';

/**
 * 取得族群資產配置（總資產 / 各族群市值與比例 / 未分類）
 */
export const useAllocation = (enabled = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [err, result] = await to(stockCategoriesService.fetchAllocation());
    if (err) {
      setError(err);
      setData(null);
    } else {
      setData(result);
    }
    setLoading(false);
    return { err };
  }, []);

  useEffect(() => {
    if (enabled) fetchData();
  }, [enabled, fetchData]);

  return { data, loading, error, refetch: fetchData };
};

export default useAllocation;
