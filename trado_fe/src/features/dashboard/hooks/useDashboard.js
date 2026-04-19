import { useState, useMemo, useCallback, useEffect } from 'react'
import { message } from 'antd'
import to from 'await-to-js'
import { dashboardService } from '../services/dashboard'

// ── helpers ──────────────────────────────────────────────
export const fmtMoney = (v) => Math.abs(v).toLocaleString()
export const fmtSign  = (v) => v > 0 ? '+' : v < 0 ? '−' : ''
export const fmtPct   = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`

const buildWeeklyTradeCount = (trades) => {
  const weeks = {}
  trades.forEach(t => {
    const d = new Date(t.date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(d)
    mon.setDate(d.getDate() + diff)
    const fri = new Date(mon)
    fri.setDate(mon.getDate() + 4)

    const label = `${mon.getMonth() + 1}/${mon.getDate()}~${fri.getMonth() + 1}/${fri.getDate()}`
    const dir = t.direction === 'long' ? '做多' : '做空'
    const key = `${mon.toISOString().slice(0, 10)}|${dir}`
    if (!weeks[key]) weeks[key] = { week: label, direction: dir, count: 0, sort: mon.toISOString().slice(0, 10) }
    weeks[key].count++
  })
  return Object.values(weeks).sort((a, b) => a.sort.localeCompare(b.sort))
}

const buildIndexDistribution = (trades) => {
  // 過濾掉 marketIndex 為 null 的交易
  const validTrades = trades.filter(t => t.marketIndex != null)
  if (validTrades.length === 0) return []

  const binSize = 500
  const bins = {}
  validTrades.forEach(t => {
    const lower = Math.floor(t.marketIndex / binSize) * binSize
    const label = `${lower.toLocaleString()}~${(lower + binSize).toLocaleString()}`
    if (!bins[lower]) bins[lower] = { range: label, 做多: 0, 做空: 0, sort: lower }
    if (t.direction === 'long') bins[lower]['做多']++
    else bins[lower]['做空']++
  })
  return Object.values(bins).sort((a, b) => a.sort - b.sort)
}

// ── hook ─────────────────────────────────────────────────
export const useDashboard = () => {
  const [periodRange, setPeriodRange] = useState('month')
  const [account, setAccount]       = useState(null)
  const [performance, setPerformance] = useState(null)
  const [strategies, setStrategies]   = useState([])
  const [trades, setTrades]           = useState([])
  const [discipline, setDiscipline]   = useState(null)
  const [loading, setLoading]         = useState(false)

  const fetchData = useCallback(async (period) => {
    setLoading(true)
    const [err, data] = await to(dashboardService.fetchDashboard(period))
    if (err) {
      message.error(err.msg || '載入儀表板失敗')
      setLoading(false)
      return
    }
    setAccount(data.account)
    setPerformance(data.performance)
    setStrategies(data.strategies)
    setTrades(data.trades)
    setDiscipline(data.discipline)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(periodRange)
  }, [periodRange, fetchData])

  // ── derived data ────────────────────────────────────────
  const perfDiff = performance
    ? (performance.myReturn != null && performance.marketReturn != null
        ? performance.myReturn - performance.marketReturn
        : null)
    : null

  // ── 策略排序 ──────────────────────────────────────────
  const sortedStrategies = useMemo(
    () => [...strategies].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)),
    [strategies],
  )

  const strategyChartData = useMemo(
    () => sortedStrategies.map(s => ({ name: s.name, value: s.pnl })),
    [sortedStrategies],
  )

  const wins   = useMemo(() => trades.filter(t => t.pnl > 0), [trades])
  const losses = useMemo(() => trades.filter(t => t.pnl < 0), [trades])
  const avgWin  = wins.length  ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length)   : 0
  const avgLoss = losses.length ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0

  const scatterData = useMemo(
    () => trades.map(t => ({ ...t, date: new Date(t.date) })),
    [trades],
  )

  const indexDist     = useMemo(() => buildIndexDistribution(trades), [trades])
  const weeklyTrades  = useMemo(() => buildWeeklyTradeCount(trades), [trades])

  return {
    // state
    periodRange,
    setPeriodRange,
    loading,
    // data
    account,
    performance,
    perfDiff,
    strategies: sortedStrategies,
    strategyChartData,
    discipline,
    // trades derived
    trades,
    scatterData,
    wins,
    losses,
    avgWin,
    avgLoss,
    // chart data
    indexDist,
    weeklyTrades,
    // actions
    refetch: () => fetchData(periodRange),
  }
}
