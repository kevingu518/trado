/**
 * Dashboard DTO — 後端回傳資料轉換
 * 後端已回傳中文 label，此處主要處理型別轉換和 null 安全
 */

const toNumber = (v) => (v != null ? Number(v) : null);

export const transformAccount = (data) => {
  if (!data) return null;
  return {
    totalAssets: toNumber(data.totalAssets) || 0,
    cashLevel: toNumber(data.cashLevel) || 0,
    openPositions: data.openPositions || 0,
    longCount: data.longCount || 0,
    shortCount: data.shortCount || 0,
    unrealizedPnL: toNumber(data.unrealizedPnL),
    assetTrend: data.assetTrend || [],
    positions: data.positions || [],
  };
};

export const transformPerformance = (data) => {
  if (!data) return null;
  return {
    myReturn: toNumber(data.myReturn),
    marketReturn: toNumber(data.marketReturn),
    myPnL: data.myPnL || 0,
    trades: data.trades || 0,
    winRate: toNumber(data.winRate) || 0,
    rrRatio: toNumber(data.rrRatio) || 0,
    maxDrawdown: toNumber(data.maxDrawdown) || 0,
    sharpe: toNumber(data.sharpe) || 0,
    avgPnl: data.avgPnl || 0,
  };
};

export const transformStrategies = (data) => {
  if (!Array.isArray(data)) return [];
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
