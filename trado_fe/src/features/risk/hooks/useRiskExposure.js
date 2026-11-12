import { useState, useEffect, useCallback } from 'react'
import { to } from 'await-to-js'
import { riskService } from '../services/risk'

/**
 * 曝險快照。跟警示分開載入：警示每 5 分鐘輪詢（見 RiskAlertsContext），
 * 曝險只在進頁面與手動重新整理時抓，beta 要跑 60 天歷史價，不需要跟著輪詢。
 */
export const useRiskExposure = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchExposure = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [err, result] = await to(riskService.fetchExposure())

    if (err) {
      setError(err)
    } else {
      setData(result)
    }
    setLoading(false)
    return { err, result }
  }, [])

  useEffect(() => {
    fetchExposure()
  }, [fetchExposure])

  return { data, loading, error, refresh: fetchExposure }
}
