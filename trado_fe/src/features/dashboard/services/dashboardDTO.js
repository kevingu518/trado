/**
 * Dashboard DTO — 後端回傳資料轉換
 * 後端已回傳中文 label，此處主要處理型別轉換和 null 安全
 *
 * 注意：績效指標刻意不把 null 轉成 0。
 * 後端在樣本不足時會回 null（< 20 日不給波動/Sharpe/beta，< 60 日不給年化/alpha/Calmar），
 * 若這裡補 0，畫面會顯示「夏普 0.00」「最大回撤 0%」——看起來像算過，其實是沒算。
 */

const toNumber = (v) => (v != null ? Number(v) : null);

export const transformAccount = (data) => {
  if (!data) return null;
  return {
    totalAssets: toNumber(data.totalAssets) || 0,
    cashLevel: toNumber(data.cashLevel) || 0,
    positionValue: toNumber(data.positionValue),
    costValue: toNumber(data.costValue),
    openPositions: data.openPositions || 0,
    longCount: data.longCount || 0,
    shortCount: data.shortCount || 0,
    unrealizedPnL: toNumber(data.unrealizedPnL),
    assetTrend: data.assetTrend || [],
    missingPriceSymbols: data.missingPriceSymbols || [],
    positions: data.positions || [],
  };
};

export const transformPerformance = (data) => {
  if (!data) return null;
  return {
    // ── 帳戶績效（TWR，已排除出入金）──
    myReturn: toNumber(data.myReturn),
    marketReturn: toNumber(data.marketReturn),
    excessReturn: toNumber(data.excessReturn),
    annualizedReturn: toNumber(data.annualizedReturn),
    maxDrawdown: toNumber(data.maxDrawdown),
    assetMaxDrawdown: toNumber(data.assetMaxDrawdown),
    volatility: toNumber(data.volatility),
    sharpe: toNumber(data.sharpe),
    sortino: toNumber(data.sortino),
    calmar: toNumber(data.calmar),
    alpha: toNumber(data.alpha),
    beta: toNumber(data.beta),
    trackingError: toNumber(data.trackingError),
    informationRatio: toNumber(data.informationRatio),
    benchmark: data.benchmark || null,
    observations: data.observations || 0,
    sampleSufficient: data.sampleSufficient !== false,
    annualizationSufficient: data.annualizationSufficient !== false,
    minObservations: data.minObservations ?? 20,
    minAnnualizedObservations: data.minAnnualizedObservations ?? 60,

    // ── 交易統計 ──
    myPnL: data.myPnL || 0,
    trades: data.trades || 0,
    winRate: toNumber(data.winRate) || 0,
    winRateCi: data.winRateCi || { low: null, high: null },
    rrRatio: toNumber(data.rrRatio) || 0,
    profitFactor: toNumber(data.profitFactor),
    expectancy: toNumber(data.expectancy),
    avgWin: data.avgWin || 0,
    avgLoss: data.avgLoss || 0,
    tradeSampleSufficient: data.tradeSampleSufficient !== false,
    minTradesForConfidence: data.minTradesForConfidence ?? 30,
    avgPnl: data.avgPnl || 0,

    // ── 以風險為單位（R）──
    risk: transformRisk(data.risk),

    // ── 圖表用 ──
    series: data.series || [],
    missingPriceSymbols: data.missingPriceSymbols || [],
  };
};

// R 統計：rTrades = 0 代表沒有交易填過停損價，算不出 R。
// 這種情況一律保留 null，不要補成 0（「0R」看起來像打平，其實是沒資料）。
export const transformRisk = (data) => {
  if (!data) return null;
  return {
    tradesTotal: data.tradesTotal || 0,
    tradesWithStop: data.tradesWithStop || 0,
    rTrades: data.rTrades || 0,
    coverage: toNumber(data.coverage) || 0,
    avgR: toNumber(data.avgR),
    medianR: toNumber(data.medianR),
    bestR: toNumber(data.bestR),
    worstR: toNumber(data.worstR),
    stopAdherence: toNumber(data.stopAdherence),
    stopBreaches: data.stopBreaches ?? null,
    distribution: Array.isArray(data.distribution) ? data.distribution : [],
  };
};

export const transformStrategies = (data) => {  if (!Array.isArray(data)) return [];
  return data.map(s => ({
    name: s.name,
    pnl: s.pnl || 0,
    winRate: toNumber(s.winRate) || 0,
    rrRatio: toNumber(s.rrRatio) || 0,
    trades: s.trades || 0,
  }));
};

export const transformTrades = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(t => ({
    date: t.date,
    symbol: t.symbol,
    pnl: t.pnl || 0,
    direction: t.direction,
    marketIndex: toNumber(t.marketIndex),
  }));
};

export const transformDiscipline = (data) => {
  if (!data) return null;
  return {
    avgRating: toNumber(data.avgRating) || 0,
    totalReviewed: data.totalReviewed || 0,
    totalTrades: data.totalTrades || 0,
    disciplinePass: data.disciplinePass || 0,
    disciplineFail: data.disciplineFail || 0,
    emotions: data.emotions || [],
    errors: data.errors || [],
  };
};

export const transformDashboard = (data) => ({
  account: transformAccount(data.account),
  performance: transformPerformance(data.performance),
  strategies: transformStrategies(data.strategies),
  trades: transformTrades(data.trades),
  discipline: transformDiscipline(data.discipline),
});
