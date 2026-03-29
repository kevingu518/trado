// ── mock data（未來接 API 時替換為真實請求）──────────────

const MOCK_ACCOUNT = {
  totalAssets:    456800,
  cashLevel:      128000,
  openPositions:  5,
  longCount:      3,
  shortCount:     2,
  unrealizedPnL:  8450,
  assetTrend:     [420000, 428000, 435000, 441000, 438000, 451000, 456800],
  positions: [
    { symbol: '2330', name: '台積電', direction: 'long',  pnl:  3200 },
    { symbol: '2454', name: '聯發科', direction: 'short', pnl:  -800 },
    { symbol: '2317', name: '鴻海',   direction: 'long',  pnl:  1850 },
    { symbol: '2882', name: '國泰金', direction: 'long',  pnl:  4200 },
    { symbol: '3711', name: '日月光', direction: 'short', pnl:   -50 },
  ],
}

const MOCK_PERF_PERIODS = {
  month: { myReturn:  3.2, marketReturn:  1.8, myPnL:  12450, trades: 16, winRate: 62.5, rrRatio: 2.14, maxDrawdown: -3.1, sharpe: 1.82, avgPnl: 778 },
  q1:    { myReturn:  7.1, marketReturn:  4.2, myPnL:  28000, trades: 35, winRate: 62.9, rrRatio: 2.33, maxDrawdown: -5.2, sharpe: 1.45, avgPnl: 800 },
  q2:    { myReturn: -0.9, marketReturn: -2.1, myPnL:  -4200, trades: 19, winRate: 42.1, rrRatio: 0.86, maxDrawdown: -8.7, sharpe: -0.32, avgPnl: -221 },
  q3:    { myReturn:  0,   marketReturn:  0,   myPnL:      0, trades: 0,  winRate: 0,    rrRatio: 0,    maxDrawdown: 0,    sharpe: 0, avgPnl: 0 },
  q4:    { myReturn:  0,   marketReturn:  0,   myPnL:      0, trades: 0,  winRate: 0,    rrRatio: 0,    maxDrawdown: 0,    sharpe: 0, avgPnl: 0 },
  year:  { myReturn:  9.2, marketReturn:  3.8, myPnL:  36250, trades: 70, winRate: 57.1, rrRatio: 1.79, maxDrawdown: -8.7, sharpe: 1.12, avgPnl: 518 },
}

const MOCK_STRATEGY_BY_PERIOD = {
  month: [
    { name: '突破策略', pnl: 5200,  winRate: 70, rrRatio: 2.5, trades: 4 },
    { name: '均線回測', pnl: 3800,  winRate: 60, rrRatio: 1.9, trades: 5 },
    { name: '籌碼面',   pnl: -1200, winRate: 40, rrRatio: 0.8, trades: 3 },
    { name: '事件驅動', pnl: 4650,  winRate: 67, rrRatio: 1.6, trades: 4 },
    { name: '動量策略', pnl: 2100,  winRate: 55, rrRatio: 1.3, trades: 3 },
    { name: '套利策略', pnl: -600,  winRate: 33, rrRatio: 0.6, trades: 2 },
    { name: '波段操作', pnl: 1500,  winRate: 50, rrRatio: 1.1, trades: 4 },
  ],
  q1: [
    { name: '突破策略', pnl: 18500, winRate: 65, rrRatio: 2.3, trades: 12 },
    { name: '均線回測', pnl: 12000, winRate: 58, rrRatio: 1.8, trades: 15 },
    { name: '籌碼面',   pnl: -4200, winRate: 42, rrRatio: 0.9, trades: 8 },
    { name: '事件驅動', pnl: 9800,  winRate: 55, rrRatio: 1.5, trades: 10 },
    { name: '動量策略', pnl: 6500,  winRate: 52, rrRatio: 1.4, trades: 9 },
    { name: '套利策略', pnl: -2800, winRate: 36, rrRatio: 0.7, trades: 7 },
    { name: '波段操作', pnl: 4300,  winRate: 50, rrRatio: 1.2, trades: 11 },
  ],
  q2: [
    { name: '突破策略', pnl: -800,  winRate: 45, rrRatio: 0.9, trades: 6 },
    { name: '均線回測', pnl: 1200,  winRate: 50, rrRatio: 1.1, trades: 8 },
    { name: '籌碼面',   pnl: -3100, winRate: 33, rrRatio: 0.7, trades: 5 },
    { name: '事件驅動', pnl: -1500, winRate: 40, rrRatio: 0.8, trades: 4 },
    { name: '動量策略', pnl: 800,   winRate: 48, rrRatio: 1.0, trades: 5 },
    { name: '套利策略', pnl: -400,  winRate: 30, rrRatio: 0.5, trades: 3 },
  ],
  q3: [], q4: [],
  year: [
    { name: '突破策略', pnl: 22900, winRate: 62, rrRatio: 2.1, trades: 22 },
    { name: '均線回測', pnl: 17000, winRate: 56, rrRatio: 1.7, trades: 28 },
    { name: '籌碼面',   pnl: -8500, winRate: 38, rrRatio: 0.8, trades: 16 },
    { name: '事件驅動', pnl: 12950, winRate: 53, rrRatio: 1.4, trades: 18 },
    { name: '動量策略', pnl: 7300,  winRate: 51, rrRatio: 1.3, trades: 14 },
    { name: '套利策略', pnl: -3200, winRate: 35, rrRatio: 0.6, trades: 10 },
    { name: '波段操作', pnl: 5800,  winRate: 49, rrRatio: 1.1, trades: 15 },
  ],
}

const MOCK_TRADES_ALL = [
  // ── Q1：1 月 ──
  { date: '2026-01-06', symbol: '2330', pnl:  4800, direction: 'long',  marketIndex: 20150 },
  { date: '2026-01-08', symbol: '2454', pnl:  -350, direction: 'short', marketIndex: 20380 },
  { date: '2026-01-13', symbol: '2317', pnl:  3200, direction: 'long',  marketIndex: 19850 },
  { date: '2026-01-15', symbol: '2412', pnl:  -600, direction: 'long',  marketIndex: 20050 },
  { date: '2026-01-20', symbol: '2882', pnl:  5600, direction: 'long',  marketIndex: 19720 },
  { date: '2026-01-22', symbol: '3711', pnl:  1800, direction: 'short', marketIndex: 20100 },
  { date: '2026-01-27', symbol: '2303', pnl: -1200, direction: 'long',  marketIndex: 20500 },
  // ── Q1：2 月 ──
  { date: '2026-02-03', symbol: '2881', pnl:  -800, direction: 'short', marketIndex: 20620 },
  { date: '2026-02-05', symbol: '2308', pnl:  2900, direction: 'long',  marketIndex: 20280 },
  { date: '2026-02-10', symbol: '3711', pnl:  6100, direction: 'long',  marketIndex: 20100 },
  { date: '2026-02-12', symbol: '2303', pnl:  -420, direction: 'short', marketIndex: 20750 },
  { date: '2026-02-17', symbol: '2886', pnl:  3700, direction: 'long',  marketIndex: 20450 },
  { date: '2026-02-19', symbol: '2330', pnl:  2100, direction: 'long',  marketIndex: 19900 },
  { date: '2026-02-24', symbol: '2454', pnl: -1500, direction: 'short', marketIndex: 21200 },
  { date: '2026-02-26', symbol: '2882', pnl:  4300, direction: 'long',  marketIndex: 19650 },
  // ── Q1：3 月（本月）──
  { date: '2026-03-03', symbol: '2330', pnl:  -900, direction: 'long',  marketIndex: 20900 },
  { date: '2026-03-04', symbol: '2454', pnl:  4200, direction: 'short', marketIndex: 21050 },
  { date: '2026-03-06', symbol: '2317', pnl:  -280, direction: 'long',  marketIndex: 20680 },
  { date: '2026-03-07', symbol: '2412', pnl:  1650, direction: 'long',  marketIndex: 20200 },
  { date: '2026-03-10', symbol: '2382', pnl:  7000, direction: 'long',  marketIndex: 20320 },
  { date: '2026-03-11', symbol: '2881', pnl: -2200, direction: 'short', marketIndex: 21300 },
  { date: '2026-03-12', symbol: '2308', pnl:  3500, direction: 'long',  marketIndex: 20050 },
  { date: '2026-03-13', symbol: '2886', pnl:  -750, direction: 'long',  marketIndex: 20800 },
  { date: '2026-03-14', symbol: '2412', pnl:  -550, direction: 'long',  marketIndex: 20550 },
  { date: '2026-03-17', symbol: '3711', pnl:  5200, direction: 'long',  marketIndex: 19800 },
  { date: '2026-03-18', symbol: '2454', pnl: -1800, direction: 'short', marketIndex: 21400 },
  { date: '2026-03-19', symbol: '2330', pnl:  2800, direction: 'long',  marketIndex: 20100 },
  { date: '2026-03-20', symbol: '2882', pnl:  6300, direction: 'long',  marketIndex: 19500 },
  { date: '2026-03-21', symbol: '2881', pnl:  3100, direction: 'short', marketIndex: 21100 },
  { date: '2026-03-24', symbol: '2886', pnl: -1100, direction: 'long',  marketIndex: 20800 },
]

const MOCK_DISCIPLINE_BY_PERIOD = {
  month: {
    avgRating: 3.4,
    totalReviewed: 12,
    totalTrades: 16,
    disciplinePass: 9,
    disciplineFail: 3,
    emotions: [
      { label: '冷靜', value: 'CALM',      count: 5 },
      { label: '焦慮', value: 'ANXIOUS',   count: 2 },
      { label: '自信', value: 'CONFIDENT', count: 3 },
      { label: '貪婪', value: 'GREEDY',    count: 1 },
      { label: '恐懼', value: 'FEARFUL',   count: 1 },
    ],
    errors: [
      { label: '出場時機錯誤', count: 3 },
      { label: '情緒控制問題', count: 2 },
      { label: '偏離策略',     count: 1 },
    ],
  },
  q1: {
    avgRating: 3.6,
    totalReviewed: 28,
    totalTrades: 35,
    disciplinePass: 22,
    disciplineFail: 6,
    emotions: [
      { label: '冷靜', value: 'CALM',      count: 12 },
      { label: '焦慮', value: 'ANXIOUS',   count: 5 },
      { label: '自信', value: 'CONFIDENT', count: 7 },
      { label: '貪婪', value: 'GREEDY',    count: 3 },
      { label: '恐懼', value: 'FEARFUL',   count: 1 },
    ],
    errors: [
      { label: '出場時機錯誤', count: 6 },
      { label: '情緒控制問題', count: 4 },
      { label: '偏離策略',     count: 3 },
      { label: '部位大小錯誤', count: 2 },
    ],
  },
  q2: {
    avgRating: 3.1,
    totalReviewed: 14,
    totalTrades: 19,
    disciplinePass: 9,
    disciplineFail: 5,
    emotions: [
      { label: '冷靜', value: 'CALM',      count: 4 },
      { label: '焦慮', value: 'ANXIOUS',   count: 5 },
      { label: '自信', value: 'CONFIDENT', count: 2 },
      { label: '貪婪', value: 'GREEDY',    count: 3 },
      { label: '恐懼', value: 'FEARFUL',   count: 2 },
    ],
    errors: [
      { label: '情緒控制問題', count: 4 },
      { label: '出場時機錯誤', count: 3 },
      { label: '偏離策略',     count: 2 },
      { label: '部位大小錯誤', count: 1 },
    ],
  },
  q3: { avgRating: 0, totalReviewed: 0, totalTrades: 0, disciplinePass: 0, disciplineFail: 0, emotions: [], errors: [] },
  q4: { avgRating: 0, totalReviewed: 0, totalTrades: 0, disciplinePass: 0, disciplineFail: 0, emotions: [], errors: [] },
  year: {
    avgRating: 3.4,
    totalReviewed: 52,
    totalTrades: 70,
    disciplinePass: 40,
    disciplineFail: 12,
    emotions: [
      { label: '冷靜', value: 'CALM',      count: 21 },
      { label: '焦慮', value: 'ANXIOUS',   count: 12 },
      { label: '自信', value: 'CONFIDENT', count: 12 },
      { label: '貪婪', value: 'GREEDY',    count: 7 },
      { label: '恐懼', value: 'FEARFUL',   count: 4 },
    ],
    errors: [
      { label: '出場時機錯誤', count: 10 },
      { label: '情緒控制問題', count: 8 },
      { label: '偏離策略',     count: 5 },
      { label: '部位大小錯誤', count: 3 },
    ],
  },
}

// 動態計算當月範圍
const getCurrentMonthRange = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = new Date(y, m, 1).toISOString().slice(0, 10)
  const last  = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  return [first, last]
}

const getQuarterRange = (y, q) => {
  const startMonth = (q - 1) * 3
  const first = new Date(y, startMonth, 1).toISOString().slice(0, 10)
  const last  = new Date(y, startMonth + 3, 0).toISOString().slice(0, 10)
  return [first, last]
}

const getPeriodRange = (period) => {
  const now = new Date()
  const y = now.getFullYear()
  switch (period) {
    case 'month': return getCurrentMonthRange()
    case 'q1':    return getQuarterRange(y, 1)
    case 'q2':    return getQuarterRange(y, 2)
    case 'q3':    return getQuarterRange(y, 3)
    case 'q4':    return getQuarterRange(y, 4)
    case 'year':  return [`${y}-01-01`, `${y}-12-31`]
    default:      return [`${y}-01-01`, `${y}-12-31`]
  }
}

const filterByPeriod = (trades, period) => {
  const [start, end] = getPeriodRange(period)
  return trades.filter(t => t.date >= start && t.date <= end)
}

// ── service（未來替換 mock 為 API 呼叫）──────────────

export const dashboardService = {
  async fetchAccount() {
    return MOCK_ACCOUNT
  },

  async fetchPerformance(period) {
    return MOCK_PERF_PERIODS[period] || MOCK_PERF_PERIODS.month
  },

  async fetchStrategies(period) {
    return MOCK_STRATEGY_BY_PERIOD[period] || []
  },

  async fetchTrades(period) {
    return filterByPeriod(MOCK_TRADES_ALL, period)
  },

  async fetchDiscipline(period) {
    return MOCK_DISCIPLINE_BY_PERIOD[period] || MOCK_DISCIPLINE_BY_PERIOD.q1
  },
}
