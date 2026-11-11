/**
 * Analysis DTO
 *
 * 後端在樣本不足時會回 null（不是 0）。這裡一律保留 null，
 * 讓畫面顯示「—」而不是把「算不出來」畫成一條貼著 0 的線。
 */

const num = (v) => {
  if (v == null) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

const transformMetrics = (m = {}) => ({
  totalReturn: num(m.totalReturn),
  xirr: num(m.xirr),
  annualizedReturn: num(m.annualizedReturn),
  marketReturn: num(m.marketReturn),
  excessReturn: num(m.excessReturn),
  volatility: num(m.volatility),
  maxDrawdown: num(m.maxDrawdown),
  sharpe: num(m.sharpe),
  sortino: num(m.sortino),
  calmar: num(m.calmar),
  beta: num(m.beta),
  alpha: num(m.alpha),
  trackingError: num(m.trackingError),
  informationRatio: num(m.informationRatio),
  sampleSufficient: !!m.sampleSufficient,
  annualizationSufficient: !!m.annualizationSufficient,
  minObservations: num(m.minObservations),
  minAnnualizedObservations: num(m.minAnnualizedObservations),
})

const transformMonthly = (rows) =>
  (rows || []).map((r) => ({
    year: num(r.year),
    month: num(r.month),
    label: r.label,
    return: num(r.return),
    benchmarkReturn: num(r.benchmarkReturn),
    tradingDays: num(r.tradingDays),
  }))

export const transformTearsheet = (data) => {
  if (!data) return null

  const summary = data.monthlySummary || {}

  return {
    meta: {
      from: data.meta?.from || null,
      to: data.meta?.to || null,
      benchmark: data.meta?.benchmark || 'TAIEX',
      benchmarks: data.meta?.benchmarks || [],
      observations: num(data.meta?.observations) ?? 0,
      rollingWindow: num(data.meta?.rollingWindow) ?? 60,
      missingPriceSymbols: data.meta?.missingPriceSymbols || [],
    },
    metrics: transformMetrics(data.metrics),
    equity: (data.equity || []).map((d) => ({
      date: d.date,
      portfolio: num(d.portfolio),
      benchmark: num(d.benchmark),
    })),
    drawdown: (data.drawdown || []).map((d) => ({
      date: d.date,
      drawdown: num(d.drawdown),
    })),
    maxDrawdownDate: data.maxDrawdownDate || null,
    monthly: transformMonthly(data.monthly),
    monthlySummary: {
      months: num(summary.months) ?? 0,
      positiveMonths: num(summary.positiveMonths) ?? 0,
      winRate: num(summary.winRate),
      best: summary.best ? { label: summary.best.label, return: num(summary.best.return) } : null,
      worst: summary.worst ? { label: summary.worst.label, return: num(summary.worst.return) } : null,
    },
    rolling: (data.rolling || []).map((d) => ({
      date: d.date,
      return: num(d.return),
      vol: num(d.vol),
      sharpe: num(d.sharpe),
    })),
  }
}

export default transformTearsheet
