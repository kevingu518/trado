import { useCallback, useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import to from 'await-to-js'
import dayjs from 'dayjs'
import { analysisService } from '../services/analysis'

export const RANGE_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '近一年', value: '1y' },
  { label: '今年', value: 'ytd' },
]

export const BENCHMARK_OPTIONS = [
  { label: '加權指數', value: 'TAIEX' },
  { label: '元大台灣50', value: '0050' },
]

/** 區間選項 → from；all 代表不設限（後端從帳號第一筆活動起算） */
const rangeToFrom = (range) => {
  if (range === '1y') return dayjs().subtract(1, 'year').format('YYYY-MM-DD')
  if (range === 'ytd') return dayjs().startOf('year').format('YYYY-MM-DD')
  return undefined
}

/**
 * 把 monthly 攤成「年 × 月」矩陣，並附上該年累積報酬。
 * 缺的月份留 null（畫成空格），不要補 0 —— 0% 會被讀成「當月打平」。
 */
const buildHeatmap = (monthly) => {
  const years = [...new Set(monthly.map((m) => m.year))].sort((a, b) => a - b)
  const byKey = new Map(monthly.map((m) => [`${m.year}-${m.month}`, m]))

  return years.map((year) => {
    let cum = 1
    let benchCum = 1
    let hasReturn = false
    let hasBench = false
    const cells = []

    for (let month = 1; month <= 12; month += 1) {
      const m = byKey.get(`${year}-${month}`)
      const ret = m?.return ?? null
      const bench = m?.benchmarkReturn ?? null

      cells.push({ month, label: m?.label || `${year}-${String(month).padStart(2, '0')}`, ret, bench, tradingDays: m?.tradingDays ?? 0 })

      if (ret != null) {
        cum *= 1 + ret
        hasReturn = true
      }
      if (bench != null) {
        benchCum *= 1 + bench
        hasBench = true
      }
    }

    return {
      year,
      cells,
      yearReturn: hasReturn ? cum - 1 : null,
      yearBenchmarkReturn: hasBench ? benchCum - 1 : null,
    }
  })
}

export const useTearsheet = () => {
  const [range, setRange] = useState('all')
  const [benchmark, setBenchmark] = useState('TAIEX')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (r, bench) => {
    setLoading(true)
    const [err, res] = await to(analysisService.fetchTearsheet({ from: rangeToFrom(r), benchmark: bench }))
    if (err) {
      message.error(err.msg || err.message || '載入績效分析失敗')
      setLoading(false)
      return
    }
    setData(res)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(range, benchmark)
  }, [range, benchmark, fetchData])

  // ── 圖表資料 ─────────────────────────────────────────
  const equityData = useMemo(() => {
    const rows = []
    for (const d of data?.equity || []) {
      if (d.portfolio != null) {
        rows.push({ date: new Date(d.date), value: d.portfolio, series: '我的績效' })
      }
      if (d.benchmark != null) {
        rows.push({ date: new Date(d.date), value: d.benchmark, series: '基準' })
      }
    }
    return rows
  }, [data])

  const drawdownData = useMemo(
    () =>
      (data?.drawdown || [])
        .filter((d) => d.drawdown != null)
        .map((d) => ({ date: new Date(d.date), value: d.drawdown * 100 })),
    [data],
  )

  const rollingReturnData = useMemo(
    () =>
      (data?.rolling || [])
        .filter((d) => d.return != null)
        .map((d) => ({ date: new Date(d.date), value: d.return * 100 })),
    [data],
  )

  const rollingVolData = useMemo(
    () =>
      (data?.rolling || [])
        .filter((d) => d.vol != null)
        .map((d) => ({ date: new Date(d.date), value: d.vol * 100 })),
    [data],
  )

  const rollingSharpeData = useMemo(
    () =>
      (data?.rolling || [])
        .filter((d) => d.sharpe != null)
        .map((d) => ({ date: new Date(d.date), value: d.sharpe })),
    [data],
  )

  const heatmap = useMemo(() => buildHeatmap(data?.monthly || []), [data])

  return {
    range,
    setRange,
    benchmark,
    setBenchmark,
    loading,
    data,
    equityData,
    drawdownData,
    rollingReturnData,
    rollingVolData,
    rollingSharpeData,
    heatmap,
    refetch: () => fetchData(range, benchmark),
  }
}
