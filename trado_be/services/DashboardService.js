import prisma from '../config/database.js';
import AccountService from './AccountService.js';

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

class DashboardService {
  /**
   * 聚合 Dashboard 所有數據
   */
  async getDashboardData(userId, period) {
    const { startDate, endDate } = this._getPeriodDateRange(period);

    const [account, performance, strategies, trades, discipline] = await Promise.all([
      this._getAccount(userId),
      this._getPerformance(userId, startDate, endDate),
      this._getStrategies(userId, startDate, endDate),
      this._getTrades(userId, startDate, endDate),
      this._getDiscipline(userId, startDate, endDate),
    ]);

    return { account, performance, strategies, trades, discipline };
  }

  // ── 帳戶快照 ──────────────────────────────────────────

  async _getAccount(userId) {
    // 動態計算含交易成本的現金餘額
    const cashBalance = await AccountService._computeCashBalance(userId);

    // 持倉統計
    const openTrades = await prisma.trade.findMany({
      where: { userId, status: 'open' },
      select: {
        symbol: true,
        direction: true,
        totalValue: true,
      },
    });

    const longCount = openTrades.filter(t => t.direction === 'long').length;
    const shortCount = openTrades.filter(t => t.direction === 'short').length;

    const positionValue = openTrades.reduce((sum, t) => {
      return sum + (t.totalValue ? Number(t.totalValue) : 0);
    }, 0);

    // 總資產 = 現金 + 持倉市值（即使沒有入金，也能從持倉顯示）
    const totalAssets = cashBalance + Math.round(positionValue);

    // 最近 7 筆快照作為 assetTrend
    const snapshots = await prisma.balanceSnapshot.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
    });
    const assetTrend = snapshots.length > 0
      ? snapshots.reverse().map(s => s.totalAssets)
      : null;

    const positions = openTrades.map(t => ({
      symbol: t.symbol,
      name: t.symbol, // 暫無股票名稱，先用代號
      direction: t.direction,
      pnl: null, // 未實現損益需要即時價格，暫為 null
    }));

    return {
      totalAssets,
      cashLevel: cashBalance,
      openPositions: openTrades.length,
      longCount,
      shortCount,
      unrealizedPnL: null,
      assetTrend,
      positions,
    };
  }

  // ── 績效指標 ──────────────────────────────────────────

  async _getPerformance(userId, startDate, endDate) {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'closed',
        closedAt: { gte: startDate, lte: endDate },
      },
      select: { netProfitLoss: true, closedAt: true },
      orderBy: { closedAt: 'asc' },
    });

    if (trades.length === 0) {
      return {
        myReturn: null,
        marketReturn: null,
        myPnL: 0,
        trades: 0,
        winRate: 0,
        rrRatio: 0,
        maxDrawdown: 0,
        sharpe: 0,
        avgPnl: 0,
      };
    }

    const pnls = trades.map(t => t.netProfitLoss || 0);
    const myPnL = pnls.reduce((a, b) => a + b, 0);
    const tradeCount = trades.length;
    const avgPnl = Math.round(myPnL / tradeCount);

    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const winRate = (wins.length / tradeCount) * 100;

    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    const rrRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0;

    // 最大回撤：用 BalanceSnapshot.totalAssets 時間序列計算
    let maxDrawdown = 0;
    const snapshots = await prisma.balanceSnapshot.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
      select: { totalAssets: true },
    });

    if (snapshots.length > 1) {
      let peak = snapshots[0].totalAssets;
      for (const snap of snapshots) {
        if (snap.totalAssets > peak) peak = snap.totalAssets;
        if (peak > 0) {
          const dd = ((snap.totalAssets - peak) / peak) * 100;
          if (dd < maxDrawdown) maxDrawdown = dd;
        }
      }
    }

    // 夏普值（簡化版：mean / stddev）
    const mean = myPnL / tradeCount;
    const variance = pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / tradeCount;
    const stddev = Math.sqrt(variance);
    const sharpe = stddev > 0 ? Number((mean / stddev).toFixed(2)) : 0;

    // 報酬率：取期初快照的 totalAssets 作為分母
    let myReturn = null;
    const startSnapshot = await prisma.balanceSnapshot.findFirst({
      where: { userId, date: { lte: startDate } },
      orderBy: { date: 'desc' },
    });
    if (startSnapshot && startSnapshot.totalAssets > 0) {
      myReturn = Number(((myPnL / startSnapshot.totalAssets) * 100).toFixed(1));
    }

    return {
      myReturn,
      marketReturn: null,
      myPnL,
      trades: tradeCount,
      winRate: Number(winRate.toFixed(1)),
      rrRatio,
      maxDrawdown: Number(maxDrawdown.toFixed(1)),
      sharpe,
      avgPnl,
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
