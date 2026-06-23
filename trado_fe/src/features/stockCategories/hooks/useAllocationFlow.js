import { useState, useEffect, useCallback } from 'react';
import { to } from 'await-to-js';
import { stockCategoriesService } from '../services/stockCategories';

/**
 * 載入族群持倉佔比「流向」資料：最新持倉 vs 上一個交易日。
 * 回傳 { data: { previous, current }, loading, error, refetch }
 */
export const useAllocationFlow = (enabled = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [err, result] = await to(stockCategoriesService.fetchAllocationFlow());
    if (err) {
      setError(err);
    } else {
      setData(result || null);
    }
    setLoading(false);
    return { err };
  }, []);

  useEffect(() => {
    if (enabled) fetchData();
  }, [enabled, fetchData]);

  return { data, loading, error, refetch: fetchData };
};

export default useAllocationFlow;
