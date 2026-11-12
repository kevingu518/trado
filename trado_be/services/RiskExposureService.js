import prisma from '../config/database.js';
import EquityService from './EquityService.js';
import StockCategoryService from './StockCategoryService.js';
import StockPriceService from './StockPriceService.js';
import { DEFAULT_BENCHMARK } from '../utils/benchmarks.js';
import { pickStopAdjustment } from './RiskAlertService.js';

/**
 * 風險中心：曝險總覽（TD-115）
 *
 * 回答一個問題：「這組持倉的風險長什麼樣？」
 *
 * 口徑（全部以「總資產 = 現金 + 持倉市值」為分母，與族群配置頁一致）：
 *   淨曝險 =（多單市值 − 空單市值）÷ 總資產
 *   毛曝險 =（多單市值 + 空單市值）÷ 總資產
 *   持倉 beta = Σ（個股市值 ÷ 總資產 × 個股 beta）
 *   總停損風險 = Σ（成本 − 停損）× 股數，佔總資產 %
 *
 * 個股 beta 用最近 60 個交易日的日報酬對加權指數（TAIEX）迴歸。
 * 樣本不足（< 30 組共同報酬）回 null，不回 0——算不出來跟「沒有風險」是兩件事。
 * 停損設錯邊（多單停損高於成本、空單停損低於成本）與沒設停損一樣，
 * 最大虧損沒有上限，單獨列出但不計入總停損風險。
 *
 * v1 門檻固定（TD-116 才會做成可設定），每一條建議都能對回一個門檻與實際數字。
 */

export const RISK_THRESHOLDS = {
  singlePositionMax: 0.2, // 單一持股上限（總資產）
  singleSectorMax: 0.4, // 單一族群上限
  cashMin: 0.1, // 現金下限
  betaHigh: 1.3,
  betaLow: 0.8,
  stopRiskMax: 0.06, // 總停損風險上限（總資產）
  nearStopPct: 0.03, // 與 TD-114 一致
  betaLookbackDays: 60,
  betaMinObservations: 30,
};

const toIso = (d) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));
const round = (v, digits = 4) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const pct = (v, digits = 1) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`);
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

/** 對 TAIEX 的日報酬迴歸出 beta。樣本不足回 null，並回報實際用了幾組 */
const computeBeta = (benchPoints, closes, minObservations) => {
  const pairs = [];
  for (const bp of benchPoints) {
    const p0 = closes.get(bp.prevDate);
    const p1 = closes.get(bp.curDate);
    if (p0 == null || p1 == null || !(p0 > 0)) continue;
    pairs.push({ stock: p1 / p0 - 1, bench: bp.ret });
  }
  if (pairs.length < minObservations) return { beta: null, observations: pairs.length };

  const mb = mean(pairs.map((p) => p.bench));
  const ms = mean(pairs.map((p) => p.stock));
  const cov =
    pairs.reduce((s, p) => s + (p.stock - ms) * (p.bench - mb), 0) / (pairs.length - 1);
  const varB = pairs.reduce((s, p) => s + (p.bench - mb) ** 2, 0) / (pairs.length - 1);
  return {
    beta: varB > 0 ? round(cov / varB, 2) : null,
    observations: pairs.length,
  };
};

class RiskExposureService {
  /**
   * @returns {Promise<Object>} 曝險快照（見 build 註解）
   */
  async getExposure(userId, { accountId = null } = {}) {
    // accountId 先收下不使用：多帳號（TD-113）接上後只要在這裡加 where 條件
    const accountFilter = accountId ? { accountId } : {};

    const trades = await prisma.trade.findMany({
      where: { userId, status: 'open', ...accountFilter },
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
    const openTrades = trades.filter((t) => (t.totalShares || 0) > 0);
    const symbols = [...new Set(openTrades.map((t) => t.symbol).filter(Boolean))];

    const [latestPrices, marketRow, allocation] = await Promise.all([
      StockPriceService.getLatest(symbols),
      prisma.stockPrice.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
      StockCategoryService.getAllocation(userId),
    ]);
    const marketIso = marketRow ? toIso(marketRow.date) : null;
    // 現金跟族群配置頁同一個算法（EquityService.computeCash），兩頁的總資產才會一致
    const cashBalance = allocation.cashBalance;

    // ── 逐筆部位的市值與停損風險 ──
    const positions = openTrades.map((t) => {
      const isLong = t.direction !== 'short';
      const shares = t.totalShares || 0;
      const avgPrice = t.avgPrice != null ? Number(t.avgPrice) : null;
      const priceInfo = latestPrices[t.symbol];
      const currentPrice = priceInfo ? priceInfo.close : null;
      // 沒有收盤價時退回成本，和 EquityService.getValuation 同一個做法，不默默算成 0
      const effectivePrice = currentPrice != null ? currentPrice : avgPrice;
      const marketValue = Math.round((effectivePrice ?? 0) * shares * (isLong ? 1 : -1));

      const stopAdj = pickStopAdjustment(t.positionAdjustments, isLong);
      const stopLoss = stopAdj ? Number(stopAdj.stopLoss) : null;
      let stopRiskAmount = null;
      if (stopLoss != null && avgPrice != null) {
        const valid = isLong ? stopLoss <= avgPrice : stopLoss >= avgPrice;
        if (valid) {
          stopRiskAmount = Math.round(
            (isLong ? avgPrice - stopLoss : stopLoss - avgPrice) * shares
          );
        }
      }

      return {
        tradeId: t.id,
        symbol: t.symbol,
        direction: t.direction,
        shares,
        avgPrice: round(avgPrice, 2),
        currentPrice,
        priceDate: priceInfo ? priceInfo.date : null,
        stale: Boolean(priceInfo && marketIso && priceInfo.date < marketIso),
        marketValue,
        unrealizedPnL:
          currentPrice != null && avgPrice != null
            ? Math.round((isLong ? 1 : -1) * (currentPrice - avgPrice) * shares)
            : null,
        stopLoss,
        stopRiskAmount,
        hasStop: stopRiskAmount != null,
        beta: null,
        betaContribution: null,
        weight: null,
      };
    });

    const longValue = positions
      .filter((p) => p.direction !== 'short')
      .reduce((s, p) => s + p.marketValue, 0);
    const shortValue = positions
      .filter((p) => p.direction === 'short')
      .reduce((s, p) => s + Math.abs(p.marketValue), 0);
    const positionsValue = longValue - shortValue;
    const totalAssets = cashBalance + positionsValue;
    const denom = totalAssets > 0 ? totalAssets : null;

    for (const p of positions) {
      p.weight = denom ? round(Math.abs(p.marketValue) / denom, 4) : null;
    }

    // ── beta：60 個交易日日報酬 vs TAIEX ──
    const betaWindow = RISK_THRESHOLDS.betaLookbackDays;
    const betaMin = RISK_THRESHOLDS.betaMinObservations;
    const endIso = marketIso || toIso(new Date());
    const startDate = new Date(`${endIso}T00:00:00.000Z`);
    // 往回 120 個日曆日，足以涵蓋 60 個交易日（週末與連假）
    startDate.setUTCDate(startDate.getUTCDate() - 120);
    const fromIso = toIso(startDate);

    const priceSeries = symbols.length
      ? await EquityService.loadPrices([...symbols, DEFAULT_BENCHMARK], fromIso, endIso)
      : new Map();
    const benchRows = (priceSeries.get(DEFAULT_BENCHMARK) || []).slice(-(betaWindow + 1));

    const benchPoints = [];
    for (let i = 1; i < benchRows.length; i += 1) {
      const prev = benchRows[i - 1];
      const cur = benchRows[i];
      if (!(prev.close > 0)) continue;
      benchPoints.push({
        prevDate: prev.date,
        curDate: cur.date,
        ret: cur.close / prev.close - 1,
      });
    }

    const betaBySymbol = new Map();
    const betaObservations = new Map();
    for (const symbol of symbols) {
      const closes = new Map((priceSeries.get(symbol) || []).map((r) => [r.date, r.close]));
      const { beta, observations } = computeBeta(benchPoints, closes, betaMin);
      betaBySymbol.set(symbol, beta);
      betaObservations.set(symbol, observations);
    }

    let weightedBeta = 0;
    let betaWeight = 0; // 有 beta 的部位佔毛曝險的比重（coverage）
    let grossWeight = 0;
    for (const p of positions) {
      const w = denom ? p.marketValue / denom : null; // 空單為負，會抵銷大盤敏感度
      const absW = denom ? Math.abs(p.marketValue) / denom : 0;
      grossWeight += absW;
      p.beta = betaBySymbol.get(p.symbol) ?? null;
      if (p.beta != null && w != null) {
        p.betaContribution = round(w * p.beta, 4);
        weightedBeta += w * p.beta;
        betaWeight += absW;
      }
    }
    const portfolioBeta = denom != null && betaWeight > 0 ? round(weightedBeta, 2) : null;

    // ── 集中度：同一代號的多筆部位先合併，再算 Top-N 與 HHI ──
    const bySymbol = new Map();
    for (const p of positions) {
      bySymbol.set(p.symbol, (bySymbol.get(p.symbol) || 0) + p.marketValue);
    }
    const holdings = [...bySymbol.entries()]
      .map(([symbol, mv]) => ({
        symbol,
        marketValue: mv,
        absValue: Math.abs(mv),
        weight: denom ? round(Math.abs(mv) / denom, 4) : null,
      }))
      .sort((a, b) => b.absValue - a.absValue);

    const topWeight = (n) =>
      denom ? round(holdings.slice(0, n).reduce((s, h) => s + h.absValue, 0) / denom, 4) : null;
    const hhi = denom
      ? round(
          holdings.reduce((s, h) => s + (h.absValue / denom) ** 2, 0),
          4
        )
      : null;
    const concentration = {
      top1: topWeight(1),
      top3: topWeight(3),
      top5: topWeight(5),
      hhi,
      holdings: holdings.map(({ symbol, marketValue, weight }) => ({
        symbol,
        marketValue,
        weight,
      })),
    };

    // ── 總停損風險與未設停損清單 ──
    const totalStopRisk = positions.reduce((s, p) => s + (p.stopRiskAmount || 0), 0);
    const noStopPositions = positions
      .filter((p) => p.stopRiskAmount == null)
      .map((p) => ({
        tradeId: p.tradeId,
        symbol: p.symbol,
        direction: p.direction,
        shares: p.shares,
        marketValue: p.marketValue,
        // 停損在錯邊時風險也不是正數，跟沒設停損一樣沒有上限
        reason: p.stopLoss == null ? 'no_stop' : 'invalid_stop',
      }));

    const stopRisk = {
      total: totalStopRisk,
      ratio: denom ? round(totalStopRisk / denom, 4) : null,
      coveredPositions: positions.filter((p) => p.stopRiskAmount != null).length,
      uncoveredPositions: noStopPositions.length,
    };

    const exposure = {
      longValue,
      shortValue,
      grossValue: longValue + shortValue,
      netValue: longValue - shortValue,
      grossRatio: denom ? round((longValue + shortValue) / denom, 4) : null,
      netRatio: denom ? round((longValue - shortValue) / denom, 4) : null,
      cashRatio: denom ? round(cashBalance / denom, 4) : null,
    };

    // ── 族群偏離：直接用族群配置頁的算法，兩頁數字不會打架 ──
    const sectors = {
      categories: (allocation?.categories || [])
        .filter((c) => c.symbolCount > 0 || c.targetRatio != null)
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          marketValue: c.marketValue,
          actualRatio: round(c.actualRatio, 4),
          targetRatio: c.targetRatio == null ? null : round(c.targetRatio, 4),
          deltaRatio: c.deltaRatio == null ? null : round(c.deltaRatio, 4),
        })),
      unclassified: allocation?.unclassified
        ? {
            marketValue: allocation.unclassified.marketValue,
            actualRatio: round(allocation.unclassified.actualRatio, 4),
          }
        : null,
    };

    const beta = {
      portfolio: portfolioBeta,
      benchmark: DEFAULT_BENCHMARK,
      windowDays: betaWindow,
      minObservations: betaMin,
      tradingDays: benchPoints.length,
      coverage: denom != null && grossWeight > 0 ? round(betaWeight / grossWeight, 4) : null,
    };

    const suggestions = this._buildSuggestions({
      exposure,
      beta,
      concentration,
      stopRisk,
      sectors,
      noStopPositions,
      thresholds: RISK_THRESHOLDS,
    });

    return {
      asOf: marketIso,
      account: {
        totalAssets,
        cashBalance,
        positionsValue,
        positions: positions.length,
      },
      exposure,
      beta,
      concentration,
      stopRisk,
      sectors,
      positions: positions.sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue)),
      noStopPositions,
      suggestions,
      thresholds: RISK_THRESHOLDS,
    };
  }

  /**
   * 規則式建議。每句話都要能對回一個門檻與實際數字，
   * 沒超標的項目不出聲，避免清單變成一片雜訊。
   */
  _buildSuggestions({ exposure, beta, concentration, stopRisk, sectors, noStopPositions, thresholds }) {
    const out = [];
    const push = (code, level, message, metric) => out.push({ code, level, message, metric });

    // 單一持股上限（用代號合併後的權重，分批進場不會被拆成兩個小部位）
    for (const h of concentration.holdings) {
      if (h.weight != null && h.weight > thresholds.singlePositionMax) {
        push(
          'position_concentration',
          'warn',
          `${h.symbol} 佔總資產 ${pct(h.weight)}，超過 ${pct(thresholds.singlePositionMax, 0)} 上限`,
          { symbol: h.symbol, weight: h.weight, limit: thresholds.singlePositionMax }
        );
      }
    }

    // 單一族群上限
    for (const c of sectors.categories) {
      if (c.actualRatio != null && c.actualRatio > thresholds.singleSectorMax) {
        push(
          'sector_concentration',
          'warn',
          `${c.name} 族群佔 ${pct(c.actualRatio)}，超過 ${pct(thresholds.singleSectorMax, 0)} 上限`,
          { category: c.name, ratio: c.actualRatio, limit: thresholds.singleSectorMax }
        );
      }
    }

    // 現金下限
    if (exposure.cashRatio != null && exposure.cashRatio < thresholds.cashMin) {
      push(
        'cash_low',
        'warn',
        `現金比重 ${pct(exposure.cashRatio)}，低於 ${pct(thresholds.cashMin, 0)} 下限`,
        { cashRatio: exposure.cashRatio, limit: thresholds.cashMin }
      );
    }

    // Beta 區間
    if (beta.portfolio != null) {
      if (beta.portfolio > thresholds.betaHigh) {
        push(
          'beta_high',
          'warn',
          `持倉 beta ${beta.portfolio.toFixed(2)}，高於 ${thresholds.betaHigh}，大盤波動會被放大`,
          { beta: beta.portfolio, limit: thresholds.betaHigh }
        );
      } else if (beta.portfolio < thresholds.betaLow) {
        push(
          'beta_low',
          'info',
          `持倉 beta ${beta.portfolio.toFixed(2)}，低於 ${thresholds.betaLow}，多頭行情會落後大盤`,
          { beta: beta.portfolio, limit: thresholds.betaLow }
        );
      }
    }

    // 總停損風險預算
    if (stopRisk.ratio != null && stopRisk.ratio > thresholds.stopRiskMax) {
      push(
        'stop_risk_over_budget',
        'warn',
        `總停損風險 ${pct(stopRisk.ratio)}（${stopRisk.total.toLocaleString()} 元），超過 ${pct(thresholds.stopRiskMax, 0)} 預算`,
        { ratio: stopRisk.ratio, limit: thresholds.stopRiskMax, amount: stopRisk.total }
      );
    }

    // 沒有停損 = 最大虧損沒有上限
    if (noStopPositions.length > 0) {
      const symbols = [...new Set(noStopPositions.map((p) => p.symbol))];
      const shown = symbols.slice(0, 3).join('、');
      push(
        'stop_missing',
        'warn',
        `${symbols.length} 檔持倉沒有有效停損（${shown}${symbols.length > 3 ? ' 等' : ''}），最大虧損沒有上限`,
        { symbols, count: symbols.length }
      );
    }

    // beta 樣本不足時明講，不要讓「算不出來」看起來像「沒問題」
    if (beta.portfolio == null && beta.tradingDays >= beta.minObservations && concentration.holdings.length > 0) {
      push(
        'beta_unavailable',
        'info',
        '部分持倉缺少足夠的歷史價格，持倉 beta 無法計算',
        { tradingDays: beta.tradingDays, minObservations: beta.minObservations }
      );
    }

    return out;
  }
}

export default new RiskExposureService();
