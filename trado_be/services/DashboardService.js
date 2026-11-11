import prisma from '../config/database.js';
import EquityService from './EquityService.js';
import RiskService from './RiskService.js';
import { DEFAULT_BENCHMARK } from '../utils/benchmarks.js';

// ── 枚舉中文映射 ──────────────────────────────────────
const EMOTION_LABELS = {
  CALM: '冷靜',
  ANXIOUS: '焦慮',
  EXCITED: '興奮',
  FEARFUL: '恐懼',
  GREEDY: '貪婪',
  CONFIDENT: '自信',
  DOUBTFUL: '猶豫',
  FRUSTRATED: '挫折',
  IMPATIENT: '急躁',
  NEUTRAL: '中性',
};

const ERROR_LABELS = {
  ENTRY_TIMING: '進場時機錯誤',
  EXIT_TIMING: '出場時機錯誤',
  POSITION_SIZE: '部位大小錯誤',
  EMOTION_CONTROL: '情緒控制問題',
  STRATEGY_DEVIATION: '偏離策略',
  RISK_MANAGEMENT: '風險管理問題',
  MARKET_ANALYSIS: '市場分析錯誤',
  OTHER: '其他',
};

/**
 * 勝率的 Wilson 95% 信賴區間
 *
 * 直接拿 wins/n 當勝率，在樣本少時會嚴重高估把握：3 勝 0 敗看起來是 100%，
 * 但它跟 300 勝 0 敗不是同一件事。Wilson 區間在 p 接近 0 或 1、n 很小時仍然穩定
 * （Wald 區間會給出超過 100% 或負的下界），適合這種「勝率」型比例。
 */
const wilsonInterval = (k, n, z = 1.96) => {
  if (n === 0) return { low: null, high: null };
  const phat = k / n;
  const denom = 1 + (z * z) / n;
  const center = (phat + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    low: Number((Math.max(0, center - margin) * 100).toFixed(1)),
    high: Number((Math.min(1, center + margin) * 100).toFixed(1)),
  };
};

// 少於這個交易筆數，勝率與盈虧比的信賴區間會太寬，前端標示為小樣本
const MIN_TRADES_FOR_CONFIDENCE = 30;

class DashboardService {
  /**
   * 聚合 Dashboard 所有數據
   */
  async getDashboardData(userId, period, benchmark = DEFAULT_BENCHMARK) {
    const { startDate, endDate } = this._getPeriodDateRange(period);

    const [account, performance, strategies, trades, discipline] = await Promise.all([
      this._getAccount(userId),
      this._getPerformance(userId, startDate, endDate, benchmark),
      this._getStrategies(userId, startDate, endDate),
      this._getTrades(userId, startDate, endDate),
      this._getDiscipline(userId, startDate, endDate),
    ]);

    return { account, performance, strategies, trades, discipline };
  }

  // ── 帳戶快照 ──────────────────────────────────────────

  async _getAccount(userId) {
    // 持倉以最新收盤價評價（純 DB 讀取；沒有收盤價的標的會列在 missingPriceSymbols）
    const valuation = await EquityService.getValuation(userId);

    const longCount = valuation.positions.filter((p) => p.direction === 'long').length;
    const shortCount = valuation.positions.filter((p) => p.direction === 'short').length;

    // 最近 7 筆快照作為 assetTrend
    const snapshots = await prisma.balanceSnapshot.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
    });
    const assetTrend = snapshots.length > 0
      ? snapshots.reverse().map(s => s.totalAssets)
      : null;

    return {
      totalAssets: valuation.totalAssets,
      cashLevel: valuation.cashBalance,
      positionValue: valuation.marketValue,
      costValue: valuation.costValue,
      openPositions: valuation.positions.length,
      longCount,
      shortCount,
      unrealizedPnL: valuation.unrealizedPnL,
      assetTrend,
      missingPriceSymbols: valuation.missingPriceSymbols,
      positions: valuation.positions.map((p) => ({
        symbol: p.symbol,
        name: p.symbol, // 暫無股票名稱，先用代號
        direction: p.direction,
        shares: p.shares,
        avgPrice: p.avgPrice,
        currentPrice: p.currentPrice,
        marketValue: p.marketValue,
        pnl: p.unrealizedPnL,
      })),
    };
  }

  // ── 績效指標 ──────────────────────────────────────────

  /**
   * 績效
   *
   * 兩類指標刻意分開，因為它們回答不同問題：
   *  - 交易統計（勝率、賺賠比、平均損益）看的是「每一筆單的品質」
   *  - 帳戶績效（TWR、年化報酬、波動、Sharpe、MDD、alpha/beta）看的是
   *    「這段時間資金實際的表現」，用每日淨值序列算，才能與基準比較
   *
   * 舊版把「每筆交易損益的平均 / 標準差」叫做夏普，那不是 Sharpe ratio：
   * 它沒有年化、沒有無風險利率、也沒有時間尺度，數字無法解讀。
   */
  async _getPerformance(userId, startDate, endDate, benchmark = DEFAULT_BENCHMARK) {
    const fromIso = startDate.toISOString().slice(0, 10);
    const toIso = endDate.toISOString().slice(0, 10);

    const [trades, equity, risk] = await Promise.all([
      prisma.trade.findMany({
        where: {
          userId,
          status: 'closed',
          closedAt: { gte: startDate, lte: endDate },
        },
        select: { netProfitLoss: true, closedAt: true },
        orderBy: { closedAt: 'asc' },
      }),
      EquityService.getPerformance(userId, { from: fromIso, to: toIso, benchmark }),
      RiskService.getRiskStats(userId, startDate, endDate),
    ]);

    const pnls = trades.map((t) => t.netProfitLoss || 0);
    const myPnL = pnls.reduce((a, b) => a + b, 0);
    const tradeCount = trades.length;
    const avgPnl = tradeCount > 0 ? Math.round(myPnL / tradeCount) : 0;

    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const winRate = tradeCount > 0 ? (wins.length / tradeCount) * 100 : 0;

    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss =
      losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    const rrRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0;

    // 獲利因子 = 總獲利 / 總虧損（金額加總，不是筆數加總）
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : null;

    // 期望值 = 每筆交易平均會賺多少。winRate 用比例而非百分比
    const pWin = tradeCount > 0 ? wins.length / tradeCount : 0;
    const expectancy =
      tradeCount > 0 ? Math.round(pWin * avgWin - (1 - pWin) * avgLoss) : null;

    // 勝率本身有抽樣誤差，附上 95% Wilson 區間與樣本數
    const winRateCi = wilsonInterval(wins.length, tradeCount);

    const pct = (v) => (v == null ? null : Number((v * 100).toFixed(1)));

    return {
      // ── 帳戶績效（TWR，已排除出入金）──
      myReturn: pct(equity.totalReturn),
      marketReturn: pct(equity.marketReturn),
      excessReturn: pct(equity.excessReturn),
      annualizedReturn: pct(equity.annualizedReturn),
      maxDrawdown: pct(equity.maxDrawdown),
      assetMaxDrawdown: pct(equity.assetMaxDrawdown),
      volatility: pct(equity.volatility),
      sharpe: equity.sharpe,
      sortino: equity.sortino,
      calmar: equity.calmar,
      alpha: pct(equity.alpha),
      beta: equity.beta,
      trackingError: pct(equity.trackingError),
      informationRatio: equity.informationRatio,
      benchmark: equity.benchmark,
      observations: equity.observations,
      // 樣本不足時年化指標一律為 null，前端據此顯示「樣本不足」而不是畫出假數字：
      //   < 20 個交易日：波動、Sharpe、Sortino、beta、追蹤誤差、資訊比率
      //   < 60 個交易日：年化報酬、alpha、Calmar
      sampleSufficient: equity.sampleSufficient,
      annualizationSufficient: equity.annualizationSufficient,
      minObservations: equity.minObservations,
      minAnnualizedObservations: equity.minAnnualizedObservations,

      // ── 交易統計 ──
      myPnL,
      trades: tradeCount,
      winRate: Number(winRate.toFixed(1)),
      winRateCi,
      rrRatio,
      profitFactor,
      expectancy,
      avgWin: Math.round(avgWin),
      avgLoss: Math.round(avgLoss),
      // 樣本少於 30 筆時，勝率與盈虧比的估計不穩定，前端要標示
      tradeSampleSufficient: tradeCount >= MIN_TRADES_FOR_CONFIDENCE,
      minTradesForConfidence: MIN_TRADES_FOR_CONFIDENCE,
      avgPnl,

      // ── 以風險為單位（R）──
      // 沒填停損價的交易算不出 R，這裡的樣本數可能遠小於 trades，
      // 前端要用 rTrades / tradesTotal 判斷資料夠不夠，不要當成 0 處理
      risk,

      // ── 圖表用 ──
      series: equity.series,
      missingPriceSymbols: equity.missingPriceSymbols,
    };
  }

  // ── 策略績效 ──────────────────────────────────────────

  async _getStrategies(userId, startDate, endDate) {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'closed',
        closedAt: { gte: startDate, lte: endDate },
      },
      select: {
        netProfitLoss: true,
        strategyId: true,
        strategy: { select: { name: true } },
      },
    });

    // 按策略分組（包含「未分類」系統策略，舊資料 strategyId 仍為 null 時也歸到 __unassigned__）
    const groups = {};
    for (const t of trades) {
      const id = t.strategyId || '__unassigned__';
      if (!groups[id]) {
        groups[id] = { name: t.strategy?.name || '未分類', trades: [] };
      }
      groups[id].trades.push(t.netProfitLoss || 0);
    }

    return Object.values(groups).map(g => {
      const pnls = g.trades;
      const pnl = pnls.reduce((a, b) => a + b, 0);
      const wins = pnls.filter(p => p > 0);
      const losses = pnls.filter(p => p < 0);
      const winRate = pnls.length > 0 ? Math.round((wins.length / pnls.length) * 100) : 0;
      const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
      const rrRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(1)) : 0;

      return {
        name: g.name,
        pnl,
        winRate,
        rrRatio,
        trades: pnls.length,
      };
    });
  }

  // ── 交易列表 ──────────────────────────────────────────

  async _getTrades(userId, startDate, endDate) {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'closed',
        closedAt: { gte: startDate, lte: endDate },
      },
      select: {
        closedAt: true,
        symbol: true,
        netProfitLoss: true,
        direction: true,
      },
      orderBy: { closedAt: 'asc' },
    });

    return trades.map(t => ({
      date: t.closedAt.toISOString().slice(0, 10),
      symbol: t.symbol,
      pnl: t.netProfitLoss || 0,
      direction: t.direction,
      marketIndex: null,
    }));
  }

  // ── 紀律追蹤 ──────────────────────────────────────────

  async _getDiscipline(userId, startDate, endDate) {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        selfRating: true,
        followedDiscipline: true,
        emotion: true,
        errorCategory: true,
        reviewNotes: true,
      },
    });

    const totalTrades = trades.length;
    if (totalTrades === 0) {
      return {
        avgRating: 0,
        totalReviewed: 0,
        totalTrades: 0,
        disciplinePass: 0,
        disciplineFail: 0,
        emotions: [],
        errors: [],
      };
    }

    // 平均自評
    const rated = trades.filter(t => t.selfRating != null);
    const avgRating = rated.length > 0
      ? Number((rated.reduce((sum, t) => sum + t.selfRating, 0) / rated.length).toFixed(1))
      : 0;

    // 已檢討筆數
    const totalReviewed = trades.filter(t => t.selfRating != null || (t.reviewNotes && t.reviewNotes.trim())).length;

    // 紀律遵守
    const disciplinePass = trades.filter(t => t.followedDiscipline === 'yes').length;
    const disciplineFail = trades.filter(t => t.followedDiscipline === 'no').length;

    // 情緒分佈
    const emotionCounts = {};
    for (const t of trades) {
      if (t.emotion) {
        emotionCounts[t.emotion] = (emotionCounts[t.emotion] || 0) + 1;
      }
    }
    const emotions = Object.entries(emotionCounts)
      .map(([value, count]) => ({
        label: EMOTION_LABELS[value] || value,
        value,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // 錯誤分佈
    const errorCounts = {};
    for (const t of trades) {
      if (t.errorCategory) {
        errorCounts[t.errorCategory] = (errorCounts[t.errorCategory] || 0) + 1;
      }
    }
    const errors = Object.entries(errorCounts)
      .map(([value, count]) => ({
        label: ERROR_LABELS[value] || value,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      avgRating,
      totalReviewed,
      totalTrades,
      disciplinePass,
      disciplineFail,
      emotions,
      errors,
    };
  }

  // ── 時間範圍工具 ──────────────────────────────────────

  _getPeriodDateRange(period) {
    const now = new Date();
    const year = now.getFullYear();

    const ranges = {
      month: [new Date(year, now.getMonth(), 1), new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999)],
      q1: [new Date(year, 0, 1), new Date(year, 2, 31, 23, 59, 59, 999)],
      q2: [new Date(year, 3, 1), new Date(year, 5, 30, 23, 59, 59, 999)],
      q3: [new Date(year, 6, 1), new Date(year, 8, 30, 23, 59, 59, 999)],
      q4: [new Date(year, 9, 1), new Date(year, 11, 31, 23, 59, 59, 999)],
      year: [new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59, 999)],
    };

    const [startDate, endDate] = ranges[period] || ranges.month;
    return { startDate, endDate };
  }
}

export default new DashboardService();
