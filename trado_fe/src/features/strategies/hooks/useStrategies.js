import { useState, useEffect, useCallback, useMemo } from 'react'
import { to } from 'await-to-js'
import { strategiesService } from '../services/strategies'
import { STRATEGY_LIMITS } from '@config/strategy.config'

export const useStrategies = (params = {}, enabled = true) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)

  const fetchStrategies = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [err, result] = await to(strategiesService.fetchStrategies(params))

    if (err) {
      setError(err)
      setData(null)
    } else {
      setData(result)
      setError(null)
    }

    setLoading(false)
    return { err, result }
  }, [
    params.page, 
    params.limit, 
    params.category, 
    params.isActive, 
    params.sortBy, 
    params.sortOrder
  ])

  // 策略數量控管（系統「未分類」策略不計入上限）
  const strategyCount = (data?.list ?? []).filter((s) => !s.isSystem).length
  const isAtLimit = strategyCount >= STRATEGY_LIMITS.MAX_STRATEGIES
  const remaining = Math.max(0, STRATEGY_LIMITS.MAX_STRATEGIES - strategyCount)

  // Create 操作
  const createStrategy = useCallback(async (payload) => {
    if (isAtLimit) {
      const limitErr = new Error(`策略數量已達上限 (${STRATEGY_LIMITS.MAX_STRATEGIES})，請先刪除不需要的策略`)
      limitErr.code = 'STRATEGY_LIMIT_EXCEEDED'
      setError(limitErr)
      return { err: limitErr, result: null }
    }

    setCreating(true)
    setError(null)

    const [err, result] = await to(strategiesService.addStrategy(payload))

    if (err) {
      setError(err)
      setCreating(false)
      return { err, result: null }
    }

    // 成功後自動重新載入列表
    await fetchStrategies()
    setCreating(false)
    return { err: null, result }
  }, [fetchStrategies, isAtLimit])

  // Update 操作
  const updateStrategy = useCallback(async (strategyId, payload) => {
    setUpdating(true)
    setError(null)

    const [err, result] = await to(strategiesService.editStrategy(strategyId, payload))

    if (err) {
      setError(err)
      setUpdating(false)
      return { err, result: null }
    }

    // 成功後自動重新載入列表
    await fetchStrategies()
    setUpdating(false)
    return { err: null, result }
  }, [fetchStrategies])

  // Delete 操作
  const deleteStrategy = useCallback(async (strategyId) => {
    setError(null)

    const [err, result] = await to(strategiesService.removeStrategy(strategyId))

    if (err) {
      setError(err)
      return { err, result: null }
    }

    // 成功後自動重新載入列表
    await fetchStrategies()
    return { err: null, result }
  }, [fetchStrategies])

  useEffect(() => {
    if (enabled) {
      fetchStrategies()
    }
  }, [enabled, fetchStrategies])

  return {
    data,
    loading,
    error,
    refetch: fetchStrategies,
    createStrategy,
    creating,
    updateStrategy,
    updating,
    deleteStrategy,
    // 策略數量控管
    strategyCount,
    isAtLimit,
    remaining,
    maxStrategies: STRATEGY_LIMITS.MAX_STRATEGIES,
  }
}

export default useStrategies
