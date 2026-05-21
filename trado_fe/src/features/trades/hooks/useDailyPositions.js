import { useState, useEffect, useCallback } from 'react'
import { to } from 'await-to-js'
import { dailyPositionsService } from '../services/dailyPositions'

export const useDailyPositions = (params = {}, enabled = true) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDailyPositions = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [err, result] = await to(dailyPositionsService.fetchDailyPositions(params))

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
    params.pageSize,
    params.startDate,
    params.endDate,
    params.symbol,
    params.direction,
    params.action,
    params.sortOrder,
  ])

  useEffect(() => {
    if (enabled) {
      fetchDailyPositions()
    }
  }, [enabled, fetchDailyPositions])

  return {
    data,
    loading,
    error,
    refetch: fetchDailyPositions,
  }
}

export default useDailyPositions
