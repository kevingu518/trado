import prisma from '../config/database.js';

/**
 * 以「初始風險」為單位的交易績效（R-multiple）
 *
 * 檢討一筆交易時，問的不是賺多少錢，而是「賺了幾個 R」：先決定停損，
 * 停損價到進場價的距離就是 1R。賺 2R 代表報酬是風險的兩倍。
 * 這樣不同價位、不同股數、不同資金比例的交易才能放在同一個尺度比較，
 * 也才能算「停損遵守率」——虧超過 1R 代表停損沒執行，或跳空滑價。
 *
 * 定義
 *   多單：每單位風險 = 進場均價 − 停損價；R = (出場均價 − 進場均價) ÷ 每單位風險
 *   空單：每單位風險 = 停損價 − 進場均價；R = (進場均價 − 出場均價) ÷ 每單位風險
 *
 * 停損價取自「第一個有填停損的進場單」。一筆交易可能分批進場，
 * 但初始風險在建倉那一刻就決定了，後面的加碼不該改寫它。
 * 沒填停損價 → 算不出 R，回 null 並排除在統計外（不是 0，也不是把輸當成沒輸）。
 */

const round2 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(2)));

// R 分布分桶。不用等分，因為結果天然擠在 −1 ~ +2 之間，等分會讓每桶幾乎全空。
export const R_BUCKETS = [
  { key: 'lt-2', label: '< −2R', from: null, to: -2 },
  { key: '-2--1', label: '−2 ~ −1R', from: -2, to: -1 },
  { key: '-1-0', label: '−1 ~ 0R', from: -1, to: 0 },
  { key: '0-1', label: '0 ~ 1R', from: 0, to: 1 },
  { key: '1-2', label: '1 ~ 2R', from: 1, to: 2 },
  { key: '2-3', label: '2 ~ 3R', from: 2, to: 3 },
  { key: 'gte3', label: '≥ 3R', from: 3, to: null },
];

const weightedAvgPrice = (adjustments) => {
  const shares = adjustments.reduce((a, x) => a + (x.shares || 0), 0);
  if (shares <= 0) return null;
  const value = adjustments.reduce((a, x) => a + (x.shares || 0) * Number(x.price), 0);
  return value / shares;
};

/**
 * 單筆交易的 R 值。純函式，方便直接驗算。
 * @returns {number|null} 無法計算時回 null
 */
export const computeTradeR = (direction, adjustments) => {
  if (!Array.isArray(adjustments) || adjustments.length === 0) return null;

  const isLong = direction !== 'short';
  const entryAction = isLong ? 'buy' : 'sell';
  const entries = adjustments.filter((a) => a.action === entryAction);
  const exits = adjustments.filter((a) => a.action !== entryAction);
  if (entries.length === 0 || exits.length === 0) return null;

  const stopAdj = entries.find((a) => a.stopLoss != null);
  if (!stopAdj) return null;

  const stop = Number(stopAdj.stopLoss);
  const avgIn = weightedAvgPrice(entries);
  const avgOut = weightedAvgPrice(exits);
  if (avgIn == null || avgOut == null) return null;

  // 停損價放錯邊（多單停損高於進場、空單停損低於進場）→ 風險不是正數，R 沒有意義
  const riskPerShare = isLong ? avgIn - stop : stop - avgIn;
  if (!(riskPerShare > 0)) return null;

  const pnlPerShare = isLong ? avgOut - avgIn : avgIn - avgOut;
  return pnlPerShare / riskPerShare;
};

const median = (sorted) => {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

class RiskService {
  /**
   * 指定期間內已平倉交易的 R 統計
   */
  async getRiskStats(userId, fromDate, toDate) {
    const trades = await prisma.trade.findMany({
      where: {
        userId,
        status: 'closed',
        closedAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        direction: true,
        positionAdjustments: {
          where: { deletedAt: null },
          orderBy: { timestamp: 'asc' },
          select: { action: true, shares: true, price: true, stopLoss: true },
        },
      },
    });

    const rValues = [];
    let tradesWithStop = 0;

    for (const t of trades) {
      const adjs = t.positionAdjustments || [];
      if (adjs.some((a) => a.stopLoss != null)) tradesWithStop += 1;
      const r = computeTradeR(t.direction, adjs);
      if (r != null && Number.isFinite(r)) rValues.push(r);
    }

    const tradesTotal = trades.length;
    const rTrades = rValues.length;

    const base = {
      tradesTotal,
      tradesWithStop,
      rTrades,
      // 有幾成的已平倉交易拿得到 R，前端據此決定要不要顯示「資料不足」
      coverage: tradesTotal > 0 ? Number(((rTrades / tradesTotal) * 100).toFixed(1)) : 0,
      avgR: null,
      medianR: null,
      bestR: null,
      worstR: null,
      // 停損遵守率：R ≥ −1 代表沒有虧超過原本設定的風險
      stopAdherence: null,
      stopBreaches: null,
      distribution: R_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: 0 })),
      buckets: R_BUCKETS,
    };

    if (rTrades === 0) return base;

    const sorted = [...rValues].sort((a, b) => a - b);
    const sum = rValues.reduce((a, b) => a + b, 0);

    const distribution = R_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      count: rValues.filter((r) => {
        if (b.from == null) return r < b.to;
        if (b.to == null) return r >= b.from;
        return r >= b.from && r < b.to;
      }).length,
    }));

    const stopBreaches = rValues.filter((r) => r < -1).length;

    return {
      ...base,
      avgR: round2(sum / rTrades),
      medianR: round2(median(sorted)),
      bestR: round2(sorted[sorted.length - 1]),
      worstR: round2(sorted[0]),
      stopAdherence: Number((((rTrades - stopBreaches) / rTrades) * 100).toFixed(1)),
      stopBreaches,
      distribution,
      buckets: R_BUCKETS,
    };
  }
}

export default new RiskService();
