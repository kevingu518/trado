// src/features/trades/hooks/usePositions.js
import { useState, useEffect, useCallback } from 'react'
import { to } from 'await-to-js'
import { positionsService } from '../services/positions'

/**
 * Hook 用於獲取交易的所有倉位
 * @param {string|number} tradeId 交易 ID
 * @param {Object} params 查詢參數
 * @param {boolean} enabled 是否啟用自動獲取
 * @returns {Object} { data, loading, error, refetch, createPosition, updatePosition, removePosition, creating, updating, removing }
 */
export const usePositions = (tradeId, params = {}, enabled = true) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [removing, setRemoving] = useState(false)

  const fetchPositions = useCallback(async () => {
    if (!tradeId) {
      setData(null)
      setLoading(false)
      return { err: null, result: null }
    }

    setLoading(true)
    setError(null)

    const [err, result] = await to(positionsService.fetchPositions(tradeId, params))

    if (err) {
      setError(err)
      setData(null)
    } else {
      setData(result)
      setError(null)
    }

    setLoading(false)
    return { err, result }
  }, [tradeId, params.page, params.pageSize])

  // Create 操作
  const createPosition = useCallback(async (payload) => {
    if (!tradeId) {
      return { err: new Error('交易 ID 不存在'), result: null }
    }

    setCreating(true)
    setError(null)

    const [err, result] = await to(positionsService.addPosition(tradeId, payload))

    if (err) {
      setError(err)
      setCreating(false)
      return { err, result: null }
    }

    // 成功後自動重新載入列表
    await fetchPositions()
    setCreating(false)
    return { err: null, result }
  }, [tradeId, fetchPositions])

  // Update 操作
  const updatePosition = useCallback(async (positionId, payload) => {
    if (!tradeId) {
      return { err: new Error('交易 ID 不存在'), result: null }
    }

    setUpdating(true)
    setError(null)

    const [err, result] = await to(positionsService.editPosition(tradeId, positionId, payload))

    if (err) {
      setError(err)
      setUpdating(false)
      return { err, result: null }
    }

    // 成功後自動重新載入列表
    await fetchPositions()
    setUpdating(false)
    return { err: null, result }
  }, [tradeId, fetchPositions])

  // Delete 操作
  const removePosition = useCallback(async (positionId) => {
    if (!tradeId) {
      return { err: new Error('交易 ID 不存在'), result: null }
    }

    setRemoving(true)
    setError(null)

    const [err, result] = await to(positionsService.removePosition(tradeId, positionId))

    if (err) {
      setError(err)
      setRemoving(false)
      return { err, result: null }
    }

    // 成功後自動重新載入列表
    await fetchPositions()
    setRemoving(false)
    return { err: null, result }
  }, [tradeId, fetchPositions])

  useEffect(() => {
    if (enabled && tradeId) {
      fetchPositions()
    }
  }, [enabled, tradeId, fetchPositions])

  return {
    data,
    loading,
    error,
    refetch: fetchPositions,
    createPosition,
    updatePosition,
    removePosition,
    creating,
    updating,
    removing,
  }
}

export default usePositions
