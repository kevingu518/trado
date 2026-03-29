import { useState, useEffect, useCallback } from 'react'
import { to } from 'await-to-js'
import { tradesService } from '../services/trades'

/**
 * Hook 用於獲取單筆交易詳情
 * @param {string|number} tradeId 交易 ID
 * @param {boolean} enabled 是否啟用自動獲取
 * @returns {Object} { data, loading, error, refetch }
 */
export const useTrade = (tradeId, enabled = true) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchTrade = useCallback(async () => {
    if (!tradeId) {
      setData(null)
      setLoading(false)
      return { err: null, result: null }
    }

    setLoading(true)
    setError(null)

    const [err, result] = await to(tradesService.fetchTrade(tradeId))

    if (err) {
      setError(err)
      setData(null)
    } else {
      setData(result)
      setError(null)
    }

    setLoading(false)
    return { err, result }
  }, [tradeId])

  useEffect(() => {
    if (enabled && tradeId) {
      fetchTrade()
    }
  }, [enabled, tradeId, fetchTrade])

  return {
    data,
    loading,
    error,
    refetch: fetchTrade,
  }
}

export default useTrade
