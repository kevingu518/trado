import prisma from '../config/database.js';
import StockPriceService from './StockPriceService.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

/**
 * 停損警示
 *
 * 每天收盤後（StockPriceJob 16:00 抓完當日價）重新算一次：
 * 哪幾檔持倉的收盤價跌破停損、哪幾檔接近停損、哪幾檔根本沒設停損。
 *
 * 「有效停損」＝最近一筆有填停損的進場單。
 * 同一筆交易可能分批進場，停損是使用者對這個部位最新的風控決定，
 * 所以取時間最晚的那筆，而不是第一次進場的。之後如果有加碼單沒填停損，
 * 不該把原本的停損吃掉，因此是「有填停損的最後一筆」，不是「最後一筆的停損」。
 *
 * 只用收盤價，不做盤中：資料來源就是 StockPrice 的每日 OHLCV，
 * 盤中警示需要即時報價，那是另一個資料源與成本，v1 不做。
 */

export const NEAR_STOP_PCT = 0.03; // 距停損 3% 內視為「接近」

export const ALERT_TYPES = ['breach', 'near', 'no_stop', 'invalid_stop', 'no_price'];

// 排序權重：跌破最急、其次停損設錯邊、再來是沒設停損與接近
const SEVERITY_RANK = {
  breach: 0,
  invalid_stop: 1,
  no_stop: 2,
  near: 3,
  no_price: 4,
};

const SEVERITY = {
  breach: 'high',
  invalid_stop: 'high',
  no_stop: 'medium',
  near: 'medium',
  no_price: 'info',
};

const toIso = (d) => d.toISOString().slice(0, 10);

const todayTaipeiIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

const round2 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(2)));

/** 最近一筆有填停損的進場單（多單看 buy、空單看 sell）；調整單已按 timestamp 升冪 */
export const pickStopAdjustment = (adjustments, isLong) => {
  const entryAction = isLong ? 'buy' : 'sell';
  const withStop = (adjustments || []).filter(
    (a) => a.action === entryAction && a.stopLoss != null
  );
  return withStop.length > 0 ? withStop[withStop.length - 1] : null;
};

const parseIsoDate = (iso) => {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new ValidationError('priceDate 格式須為 YYYY-MM-DD');
  }
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError('priceDate 不是有效日期');
  }
  return d;
};

class RiskAlertService {
  /**
   * 目前持倉的停損警示（含已讀狀態）
   * @returns {{ asOf: string, alerts: Array, summary: Object }}
   */
  async getAlerts(userId) {
    const trades = await prisma.trade.findMany({
      where: { userId, status: 'open' },
      select: {
        id: true,
        symbol: true,
        direction: true,
        totalShares: true,
        avgPrice: true,
        positionAdjustments: {
          where: { deletedAt: null },
          orderBy: { timestamp: 'asc' },
          select: { action: true, stopLoss: true, timestamp: true },
        },
      },
    });

    const positions = trades.filter((t) => (t.totalShares || 0) > 0);
    const symbols = [...new Set(positions.map((t) => t.symbol).filter(Boolean))];

    const [latestPrices, marketRow] = await Promise.all([
      StockPriceService.getLatest(symbols),
      prisma.stockPrice.findFirst({
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ]);
    const marketIso = marketRow ? toIso(marketRow.date) : null;

    const alerts = [];
    for (const trade of positions) {
      const alert = this._buildAlert(trade, latestPrices[trade.symbol], marketIso);
      if (alert) alerts.push(alert);
    }

    // 已讀紀錄：同一 tradeId + alertType + priceDate 只算一次
    const acks = alerts.length
      ? await prisma.riskAlertAck.findMany({
          where: {
            userId,
            tradeId: { in: alerts.map((a) => a.tradeId) },
          },
          select: { tradeId: true, alertType: true, priceDate: true },
        })
      : [];
    const acked = new Set(acks.map((a) => `${a.tradeId}|${a.alertType}|${toIso(a.priceDate)}`));
    for (const a of alerts) {
      a.acknowledged = acked.has(`${a.tradeId}|${a.alertType}|${a.priceDate}`);
    }

    alerts.sort((a, b) => {
      const rank = SEVERITY_RANK[a.alertType] - SEVERITY_RANK[b.alertType];
      if (rank !== 0) return rank;
      const da = a.distancePct ?? Infinity;
      const db = b.distancePct ?? Infinity;
      if (da !== db) return da - db;
      return a.symbol.localeCompare(b.symbol);
    });

    const count = (type) => alerts.filter((a) => a.alertType === type).length;
    const summary = {
      openPositions: positions.length,
      total: alerts.length,
      unacked: alerts.filter((a) => !a.acknowledged).length,
      breach: count('breach'),
      near: count('near'),
      noStop: count('no_stop'),
      invalidStop: count('invalid_stop'),
      noPrice: count('no_price'),
    };

    return {
      asOf: marketIso || todayTaipeiIso(),
      alerts,
      summary,
    };
  }

  /**
   * 單一持倉的警示。沒有異常回 null（正常持倉不該出現在警示清單）
   */
  _buildAlert(trade, priceInfo, marketIso) {
    const isLong = trade.direction !== 'short';
    const shares = trade.totalShares || 0;
    const avgPrice = trade.avgPrice != null ? Number(trade.avgPrice) : null;
    const currentPrice = priceInfo ? priceInfo.close : null;
    const priceDate = priceInfo ? priceInfo.date : marketIso || todayTaipeiIso();
    const stopAdj = pickStopAdjustment(trade.positionAdjustments, isLong);
    const stopLoss = stopAdj ? Number(stopAdj.stopLoss) : null;

    const unrealizedPnL =
      currentPrice != null && avgPrice != null
        ? Math.round((isLong ? 1 : -1) * (currentPrice - avgPrice) * shares)
        : null;

    const base = {
      tradeId: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      shares,
      avgPrice,
      stopLoss,
      currentPrice,
      priceDate,
      // 這檔的報價比市場最新交易日舊（停牌、抓價失敗）→ 前端標記，避免誤讀成今天的價
      stale: Boolean(priceInfo && marketIso && priceInfo.date < marketIso),
      unrealizedPnL,
      stopRiskAmount: null,
      distancePct: null,
      // 以「進場均價 → 停損價」為 1R，目前價格離停損還有幾個 R
      remainingR: null,
    };

    if (!stopAdj) {
      return { ...base, alertType: 'no_stop', severity: SEVERITY.no_stop };
    }

    // 停損放錯邊：多單停損高於進場均價、空單停損低於進場均價 → 風險不是正數，等於沒設。
    // 等於進場均價不算錯邊（移動停損到成本價是常見做法），此時風險為 0，仍照常判斷跌破。
    if (avgPrice != null) {
      const invalid = isLong ? stopLoss > avgPrice : stopLoss < avgPrice;
      if (invalid) {
        return { ...base, alertType: 'invalid_stop', severity: SEVERITY.invalid_stop };
      }
      base.stopRiskAmount = Math.round(
        (isLong ? avgPrice - stopLoss : stopLoss - avgPrice) * shares
      );
    }

    if (currentPrice == null || stopLoss == null || !(stopLoss > 0)) {
      return { ...base, alertType: 'no_price', severity: SEVERITY.no_price };
    }

    // 距停損比例，以停損價為基準；負數代表已經跌破
    const distance = isLong
      ? (currentPrice - stopLoss) / stopLoss
      : (stopLoss - currentPrice) / stopLoss;
    base.distancePct = round2(distance * 100);

    // 剩餘 R：跌破時為負，代表已經超過原本設定的 1R 風險
    if (avgPrice != null) {
      const riskPerShare = isLong ? avgPrice - stopLoss : stopLoss - avgPrice;
      if (riskPerShare > 0) {
        const room = isLong ? currentPrice - stopLoss : stopLoss - currentPrice;
        base.remainingR = round2(room / riskPerShare);
      }
    }

    if (distance <= 0) {
      return { ...base, alertType: 'breach', severity: SEVERITY.breach };
    }
    if (distance <= NEAR_STOP_PCT) {
      return { ...base, alertType: 'near', severity: SEVERITY.near };
    }
    return null;
  }

  async _assertOwnTrade(userId, tradeId) {
    const trade = await prisma.trade.findFirst({
      where: { id: tradeId, userId },
      select: { id: true },
    });
    if (!trade) throw new NotFoundError('Trade not found');
  }

  /** 標記單一警示為已讀 */
  async acknowledge(userId, { tradeId, alertType, priceDate }) {
    if (!tradeId) throw new ValidationError('tradeId 必填');
    if (!ALERT_TYPES.includes(alertType)) throw new ValidationError('alertType 不正確');
    const date = parseIsoDate(priceDate);
    await this._assertOwnTrade(userId, tradeId);

    await prisma.riskAlertAck.upsert({
      where: {
        userId_tradeId_alertType_priceDate: {
          userId,
          tradeId,
          alertType,
          priceDate: date,
        },
      },
      update: {},
      create: { userId, tradeId, alertType, priceDate: date },
    });
    return { tradeId, alertType, priceDate, acknowledged: true };
  }

  /** 取消已讀（誤按時復原） */
  async unacknowledge(userId, { tradeId, alertType, priceDate }) {
    if (!tradeId) throw new ValidationError('tradeId 必填');
    if (!ALERT_TYPES.includes(alertType)) throw new ValidationError('alertType 不正確');
    const date = parseIsoDate(priceDate);

    await prisma.riskAlertAck.deleteMany({
      where: { userId, tradeId, alertType, priceDate: date },
    });
    return { tradeId, alertType, priceDate, acknowledged: false };
  }

  /** 一次把目前所有未讀警示標成已讀 */
  async acknowledgeAll(userId) {
    const { alerts } = await this.getAlerts(userId);
    const pending = alerts.filter((a) => !a.acknowledged);
    if (pending.length === 0) return { acknowledged: 0 };

    await prisma.riskAlertAck.createMany({
      data: pending.map((a) => ({
        userId,
        tradeId: a.tradeId,
        alertType: a.alertType,
        priceDate: parseIsoDate(a.priceDate),
      })),
      skipDuplicates: true,
    });
    return { acknowledged: pending.length };
  }
}

export default new RiskAlertService();
