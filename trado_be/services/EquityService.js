/**
 * EquityService — 以「收盤市值」計算資產淨值序列與風險調整後績效
 *
 * 為什麼要這一層：
 *  舊版快照的 positionValue 用的是 Trade.totalValue，那其實是「持倉成本」
 *  （totalShares × avgPrice）。成本不隨行情變動，所以總資產曲線在持有期間
 *  是一條水平線，MDD 永遠是 0、報酬率無法反映未實現損益。
 *
 * 這一層做三件事：
 *  1. 用每日收盤價把持倉換算成市值（mark-to-market）
 *  2. 用 TWR（時間加權報酬）串起每日報酬，排除出入金造成的資產跳動
 *  3. 從日報酬序列算年化波動、Sharpe / Sortino / Calmar、最大回撤、
 *     以及對基準（TAIEX / 0050）的 beta、alpha、追蹤誤差、資訊比率
 *
 * 已知限制（誠實揭露，不假裝算得出來）：
 *  - User.cashAdjustment 是單一純量，歷史現金只能當成一個固定偏移量，
 *    無法還原「使用者是在哪一天設定現金餘額」。因此現金水位在設定日之前
 *    可能不精確；但因為 TWR 只看相鄰兩日的變化，固定偏移會互相抵消，
 *    對報酬與回撤的影響有限。
 *  - 缺少價格的股票（未 cache）會退回「最後一筆成交價」，並回報在
 *    missingPriceSymbols，不猜測、不捏造。
 */

import prisma from '../config/database.js';
import CorporateActionService, { applyCorporateActions } from './CorporateActionService.js';
import StockPriceService from './StockPriceService.js';
import { BENCHMARKS, DEFAULT_BENCHMARK } from '../utils/benchmarks.js';
import { xirr } from '../utils/xirr.js';

export const TRADING_DAYS_PER_YEAR = 252;
export const DEFAULT_RISK_FREE_RATE = 0.015; // 台股一年期定存概略值，可在呼叫端覆寫

// 少於這個觀察數就不輸出年化風險指標。一個月只有 ~20 個交易日，
// 用 3 天算出來的「夏普 −12.8」「beta 3.98」不是資訊，是雜訊。
export const MIN_OBSERVATIONS = 20;

// 「年化報酬」「alpha」「Calmar」是把區間結果複利或乘以 252 外推，
// 樣本太短時會炸掉：22 個交易日跌 25.4%，年化會變成 −96.5%，
// 數字沒錯但那是在推測十一個月，不是在描述已發生的事。這類指標要求約一季。
export const MIN_ANNUALIZED_OBSERVATIONS = 60;

const toIso = (d) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));
const todayIso = () => toIso(new Date());

const sum = (arr) => arr.reduce((s, x) => s + x, 0);

const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

// 樣本標準差（除以 n-1）。Sharpe 用樣本標準差是一般慣例
const stdev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map((x) => (x - m) ** 2)) / (arr.length - 1));
};

const round = (n, digits) => (n == null || Number.isNaN(n) ? null : Number(n.toFixed(digits)));

/**
 * 把升冪的 close 序列包成「查某天（含）之前最後一個收盤價」的查詢器。
 * 因為呼叫端是照日期遞增走訪，用一個游標就夠，不必二分搜尋。
 */
const makeCloseLookup = (rows) => {
  let i = 0;
  let last = null;
  return (dayIso) => {
    while (i < rows.length && rows[i].date <= dayIso) {
      last = rows[i].close;
      i += 1;
    }
    return last;
  };
};

class EquityService {
  /**
   * 從 DB（可選：補抓外部）載入多個 symbol 的收盤價序列
   * @returns {Promise<Map<string, Array<{date: string, close: number}>>>}
   */
  async loadPrices(symbols, fromIso, toIsoDate, { allowFetch = false, adjust = true } = {}) {
    const uniq = [...new Set(symbols.filter(Boolean))];
    const out = new Map(uniq.map((s) => [s, []]));
    if (uniq.length === 0) return out;

    if (allowFetch) {
      // 逐檔補齊（StockPriceService 內部有 250ms 節流，這裡刻意序列化）
      for (const symbol of uniq) {
        try {
          const rows = await StockPriceService.getKlineRange(symbol, fromIso, toIsoDate);
          out.set(
            symbol,
            rows
              .filter((r) => r.date >= fromIso && r.date <= toIsoDate)
              .map((r) => ({ date: r.date, close: r.close }))
          );
        } catch (err) {
          console.warn(`[EquityService] 載入 ${symbol} 價格失敗：${err.message}`);
        }
      }
    } else {
      const rows = await prisma.stockPrice.findMany({
        where: {
          symbol: { in: uniq },
          date: { gte: new Date(fromIso), lte: new Date(toIsoDate) },
        },
        orderBy: [{ symbol: 'asc' }, { date: 'asc' }],
        select: { symbol: true, date: true, close: true },
      });

      for (const r of rows) {
        out.get(r.symbol)?.push({ date: toIso(r.date), close: Number(r.close) });
      }
    }

    // 除權息還原：只用「含息報酬」算績效，否則每次配息都會被記成一次虧損。
    // adjusted=false 給需要真實市價的呼叫端（例如部位估值）。
    if (adjust) {
      const actions = await CorporateActionService.getActionsForSymbols(
        uniq,
        fromIso,
        toIsoDate
      );
      for (const [symbol, rows] of out) {
        const acts = actions.get(symbol) || [];
        if (acts.length === 0 || rows.length === 0) continue;
        // close 一律代表「用來算報酬的價格」，原始價留在 rawClose，避免呼叫端誤用
        out.set(
          symbol,
          applyCorporateActions(rows, acts).map((r) => ({
            date: r.date,
            close: r.adjClose,
            rawClose: r.close,
          }))
        );
      }
    }
    return out;
  }

  /**
   * 取使用者的成交與出入金，算出每日現金與持股市值
   */
  async _loadLedger(userId) {
    const [user, fills, txns] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { cashAdjustment: true } }),
      prisma.positionAdjustment.findMany({
        where: { deletedAt: null, trade: { userId } },
        orderBy: { timestamp: 'asc' },
        select: {
          action: true,
          shares: true,
          price: true,
          fee: true,
          tax: true,
          timestamp: true,
          trade: { select: { symbol: true, direction: true } },
        },
      }),
      prisma.accountTransaction.findMany({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { type: true, amount: true, date: true },
      }),
    ]);

    return {
      cashAdjustment: Number(user?.cashAdjustment || 0),
      fills: fills.map((f) => ({
        date: toIso(f.timestamp),
        action: f.action,
        shares: f.shares,
        price: Number(f.price),
        fee: f.fee || 0,
        tax: f.tax || 0,
        symbol: f.trade?.symbol || null,
        direction: f.trade?.direction || 'long',
      })),
      txns: txns
        // set_balance 只是 log，實際金額已反映在 cashAdjustment
        .filter((t) => t.type === 'deposit' || t.type === 'withdraw')
        .map((t) => ({ date: toIso(t.date), type: t.type, amount: t.amount })),
    };
  }

  /**
   * 找這個帳號最早的活動日（成交 / 出入金 / 既有快照）
   */
  async _earliestActivityIso(userId) {
    const [fill, txn, snap] = await Promise.all([
      prisma.positionAdjustment.findFirst({
        where: { deletedAt: null, trade: { userId } },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      }),
      prisma.accountTransaction.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
      prisma.balanceSnapshot.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
    ]);
    const candidates = [fill?.timestamp, txn?.date, snap?.date].filter(Boolean).map(toIso);
    return candidates.length ? candidates.sort()[0] : todayIso();
  }

  /**
   * MWR / XIRR：資金加權年化報酬
   *
   * TWR 回答「這套進出方法賺不賺錢」，XIRR 回答「我這筆錢實際賺多少」。
   * 兩者差很多時，通常是加碼時機（大筆資金進場的時點）在拉抬或拖累結果。
   *
   * 現金流以投資人角度記號：入金為負、出金與期末淨值為正。
   * cashAdjustment 無法還原「使用者哪一天設定的」，只能當成期初的一筆投入；
   * 這是已知誤差，所以 XIRR 只適合當輔助指標，不取代 TWR。
   *
   * @param {string} userId
   * @param {number} endValue 期末總資產（收盤市值 + 現金）
   * @param {string} endDate  YYYY-MM-DD，通常是最後一個評價日
   * @returns {Promise<number|null>} 比例（0.15 = 15%）；無解時回 null
   */
  async computeXirr(userId, endValue, endDate) {
    if (!(endValue > 0) || !endDate) return null;

    const [ledger, firstActivity] = await Promise.all([
      this._loadLedger(userId),
      this._earliestActivityIso(userId),
    ]);

    const flows = [];
    if (ledger.cashAdjustment) {
      // 補正值代表「沒有交易紀錄佐證、但實際存在的現金」，視為期初投入
      flows.push({ date: firstActivity, amount: -ledger.cashAdjustment });
    }
    for (const t of ledger.txns) {
      if (t.date > endDate) continue; // 期末之後的出入金不屬於這個期間
      flows.push({ date: t.date, amount: t.type === 'deposit' ? -t.amount : t.amount });
    }
    flows.push({ date: endDate, amount: endValue });

    const rate = xirr(flows);
    return rate == null ? null : Number(rate.toFixed(6));
  }

  /**
   * 建立每日淨值序列
   *
   * 交易日曆以基準（預設 TAIEX）的收盤資料為準：有價格的日期才是交易日。
   * 若基準完全沒有資料，退回用「所有持倉 symbol 有價格的日期」聯集。
   *
   * @returns {Promise<{
   *   days: Array<{date, cash, positionValue, totalAssets, netFlow, twrIndex, benchmarkClose}>,
   *   from, to, benchmark, missingPriceSymbols
   * }>}
   */
  async buildSeries(userId, {
    from,
    to,
    benchmark = DEFAULT_BENCHMARK,
    allowFetch = false,
  } = {}) {
    const ledger = await this._loadLedger(userId);

    // 期初不可早於帳號的第一筆活動：再往前帳上沒有資料，多出來的只是
    // 一串「現金沒動、報酬為 0」的空轉日，會稀釋年化波動與 Sharpe
    const earliest = await this._earliestActivityIso(userId);
    const requestedFrom = from || earliest;
    const fromIso = requestedFrom < earliest ? earliest : requestedFrom;
    const cap = to || todayIso();
    const toIsoDate = cap < todayIso() ? cap : todayIso();

    const heldSymbols = [...new Set(ledger.fills.map((f) => f.symbol).filter(Boolean))];
    const prices = await this.loadPrices(
      [...heldSymbols, benchmark],
      fromIso,
      toIsoDate,
      { allowFetch }
    );

    const benchRows = prices.get(benchmark) || [];
    const benchByDate = new Map(benchRows.map((r) => [r.date, r.close]));

    // 交易日曆
    let dates;
    if (benchRows.length > 0) {
      // 有基準就用基準的交易日。成交日若落在非交易日（週末補登、假日），
      // 併到下一個交易日評價即可；硬把它加進序列只會多出幾筆幾乎 0 的日報酬，
      // 稀釋波動率。
      dates = benchRows.map((r) => r.date);
      // 例外：基準最後一天之後的成交（例如今天成交、今天收盤價還沒 publish）
      // 仍要留一格，否則當天的部位變化會看不到
      const lastBenchDate = dates[dates.length - 1];
      const tail = ledger.fills
        .map((f) => f.date)
        .filter((d) => d > lastBenchDate && d <= toIsoDate);
      if (tail.length) dates = [...new Set([...dates, ...tail])].sort();
    } else {
      const union = new Set();
      for (const s of heldSymbols) {
        for (const r of prices.get(s) || []) union.add(r.date);
      }
      for (const f of ledger.fills) {
        if (f.date >= fromIso && f.date <= toIsoDate) union.add(f.date);
      }
      dates = [...union].sort();
    }
    dates = dates.filter((d) => d >= fromIso && d <= toIsoDate);
    if (dates.length === 0) {
      return {
        days: [],
        from: fromIso,
        to: toIsoDate,
        benchmark,
        missingPriceSymbols: heldSymbols,
      };
    }

    const closeLookup = new Map();
    for (const symbol of heldSymbols) {
      closeLookup.set(symbol, makeCloseLookup(prices.get(symbol) || []));
    }
    // 游標：成交與出入金都照日期遞增走訪
    let fi = 0;
    let ti = 0;
    let cash = ledger.cashAdjustment;
    const shares = new Map(); // symbol -> 帶方向的股數（short 為負）
    const lastFillPrice = new Map();
    const missingPriceSymbols = new Set();

    const days = [];

    for (const day of dates) {
      // 1. 先套用當日（含）之前的出入金
      let netFlow = 0;
      while (ti < ledger.txns.length && ledger.txns[ti].date <= day) {
        const t = ledger.txns[ti];
        const signed = t.type === 'deposit' ? t.amount : -t.amount;
        cash += signed;
        // 只有當天的出入金算作「當期外部現金流」，更早的已反映在期初資產
        if (t.date === day) netFlow += signed;
        ti += 1;
      }

      // 2. 再套用當日（含）之前的成交
      while (fi < ledger.fills.length && ledger.fills[fi].date <= day) {
        const f = ledger.fills[fi];
        const gross = f.shares * f.price;
        if (f.action === 'buy') {
          cash -= gross + f.fee;
          shares.set(f.symbol, (shares.get(f.symbol) || 0) + f.shares);
        } else if (f.action === 'sell') {
          cash += gross - f.fee - f.tax;
          shares.set(f.symbol, (shares.get(f.symbol) || 0) - f.shares);
        }
        lastFillPrice.set(f.symbol, f.price);
        fi += 1;
      }

      // 3. 以收盤價評價（空單為負值，代表負債）
      let positionValue = 0;
      for (const [symbol, qty] of shares) {
        if (!qty) continue;
        let price = closeLookup.get(symbol)?.(day);
        if (price == null) {
          price = lastFillPrice.get(symbol) ?? null;
          if (price != null) missingPriceSymbols.add(symbol);
        }
        if (price == null) continue;
        positionValue += qty * price;
      }

      const cashRounded = Math.round(cash);
      const positionRounded = Math.round(positionValue);
      days.push({
        date: day,
        cash: cashRounded,
        positionValue: positionRounded,
        totalAssets: cashRounded + positionRounded,
        netFlow: Math.round(netFlow),
        benchmarkClose: benchByDate.get(day) ?? null,
        twrIndex: 1,
      });
    }

    // 4. TWR：把相鄰兩日的資產變化串起來，並剔除出入金造成的跳動
    for (let i = 1; i < days.length; i += 1) {
      const prev = days[i - 1];
      const cur = days[i];
      let r = 0;
      if (prev.totalAssets > 0) {
        r = (cur.totalAssets - cur.netFlow) / prev.totalAssets - 1;
      }
      cur.twrIndex = prev.twrIndex * (1 + r);
    }

    return {
      days,
      from: fromIso,
      to: toIsoDate,
      benchmark,
      missingPriceSymbols: [...missingPriceSymbols],
    };
  }

  /**
   * 從淨值序列計算績效指標
   *
   * 報酬用 TWR（時間加權），波動 / Sharpe / Sortino 用「日報酬」年化，
   * 而不是用「每筆交易損益」算平均除以標準差 —— 後者不是 Sharpe ratio，
   * 它衡量的是單筆損益的穩定度，與時間尺度無關，無法與基準比較。
   */
  computeMetrics(days, {
    riskFreeRate = DEFAULT_RISK_FREE_RATE,
    periodsPerYear = TRADING_DAYS_PER_YEAR,
  } = {}) {
    if (!days || days.length < 2) {
      return this._emptyMetrics(riskFreeRate, periodsPerYear);
    }

    const rets = [];
    const benchRets = [];
    const pairs = []; // 日期對齊後的 (portfolio, benchmark)
    for (let i = 1; i < days.length; i += 1) {
      const prev = days[i - 1];
      const cur = days[i];
      const r = cur.twrIndex / prev.twrIndex - 1;
      rets.push(r);

      const b0 = prev.benchmarkClose;
      const b1 = cur.benchmarkClose;
      if (b0 && b1) {
        const br = b1 / b0 - 1;
        benchRets.push(br);
        pairs.push({ date: cur.date, portfolio: r, benchmark: br });
      }
    }

    const n = rets.length;
    const sampleSufficient = n >= MIN_OBSERVATIONS;
    const annualizationSufficient = n >= MIN_ANNUALIZED_OBSERVATIONS;
    const totalReturn = days[days.length - 1].twrIndex / days[0].twrIndex - 1;
    const annualizedReturn =
      annualizationSufficient && 1 + totalReturn > 0
        ? Math.pow(1 + totalReturn, periodsPerYear / n) - 1
        : null;

    const rfDaily = riskFreeRate / periodsPerYear;
    const excess = rets.map((r) => r - rfDaily);
    const sd = stdev(rets);
    const downside = rets.filter((r) => r < rfDaily).map((r) => r - rfDaily);
    const downsideDev = downside.length ? Math.sqrt(sum(downside.map((x) => x ** 2)) / downside.length) : 0;

    const volatility = sampleSufficient ? sd * Math.sqrt(periodsPerYear) : null;
    const sharpe =
      sampleSufficient && sd > 0 ? (mean(excess) / sd) * Math.sqrt(periodsPerYear) : null;
    const sortino =
      sampleSufficient && downsideDev > 0
        ? (mean(excess) / downsideDev) * Math.sqrt(periodsPerYear)
        : null;

    // 最大回撤：以 TWR 指數為準（已排除出入金），另附原始資產曲線的回撤供對照
    const ddFrom = (values) => {
      let peak = values[0];
      let mdd = 0;
      for (const v of values) {
        if (v > peak) peak = v;
        if (peak > 0) mdd = Math.min(mdd, v / peak - 1);
      }
      return mdd;
    };
    const maxDrawdown = ddFrom(days.map((d) => d.twrIndex));
    const assetMaxDrawdown = ddFrom(days.map((d) => d.totalAssets));

    const calmar =
      annualizedReturn != null && maxDrawdown < 0
        ? annualizedReturn / Math.abs(maxDrawdown)
        : null;

    // ── 對基準的相對指標 ──
    let marketReturn = null;
    let alpha = null;
    let beta = null;
    let trackingError = null;
    let informationRatio = null;

    if (benchRets.length >= 2) {
      // 基準報酬只是區間漲跌幅，樣本少也照算
      const firstBench = days.find((d) => d.benchmarkClose != null)?.benchmarkClose;
      const lastBench = [...days].reverse().find((d) => d.benchmarkClose != null)?.benchmarkClose;
      if (firstBench && lastBench) marketReturn = lastBench / firstBench - 1;
    }

    // beta / alpha / 追蹤誤差 / 資訊比率是統計量，樣本不足時整組不輸出
    if (sampleSufficient && benchRets.length >= 2) {
      const pr = pairs.map((p) => p.portfolio);
      const br = pairs.map((p) => p.benchmark);
      const mp = mean(pr);
      const mb = mean(br);
      const cov =
        pairs.length > 1
          ? sum(pairs.map((p) => (p.portfolio - mp) * (p.benchmark - mb))) / (pairs.length - 1)
          : 0;
      const varB = stdev(br) ** 2;
      beta = varB > 0 ? cov / varB : null;
      if (beta != null && annualizationSufficient) {
        alpha = (mp - rfDaily - beta * (mb - rfDaily)) * periodsPerYear;
      }
      const active = pairs.map((p) => p.portfolio - p.benchmark);
      const te = stdev(active);
      trackingError = te * Math.sqrt(periodsPerYear);
      informationRatio = te > 0 ? (mean(active) / te) * Math.sqrt(periodsPerYear) : null;
    }

    return {
      observations: n,
      sampleSufficient,
      annualizationSufficient,
      minObservations: MIN_OBSERVATIONS,
      minAnnualizedObservations: MIN_ANNUALIZED_OBSERVATIONS,
      from: days[0].date,
      to: days[days.length - 1].date,
      startAssets: days[0].totalAssets,
      endAssets: days[days.length - 1].totalAssets,
      totalReturn: round(totalReturn, 4),
      annualizedReturn: round(annualizedReturn, 4),
      marketReturn: round(marketReturn, 4),
      excessReturn:
        marketReturn != null ? round(totalReturn - marketReturn, 4) : null,
      volatility: round(volatility, 4),
      maxDrawdown: round(maxDrawdown, 4),
      assetMaxDrawdown: round(assetMaxDrawdown, 4),
      sharpe: round(sharpe, 2),
      sortino: round(sortino, 2),
      calmar: round(calmar, 2),
      beta: round(beta, 2),
      alpha: round(alpha, 4),
      trackingError: round(trackingError, 4),
      informationRatio: round(informationRatio, 2),
      riskFreeRate,
      periodsPerYear,
      dailyReturns: pairs.map((p) => ({
        date: p.date,
        portfolio: round(p.portfolio, 6),
        benchmark: round(p.benchmark, 6),
      })),
    };
  }

  _emptyMetrics(riskFreeRate, periodsPerYear) {
    return {
      observations: 0,
      sampleSufficient: false,
      annualizationSufficient: false,
      minObservations: MIN_OBSERVATIONS,
      minAnnualizedObservations: MIN_ANNUALIZED_OBSERVATIONS,
      from: null,
      to: null,
      startAssets: 0,
      endAssets: 0,
      totalReturn: null,
      annualizedReturn: null,
      marketReturn: null,
      excessReturn: null,
      volatility: null,
      maxDrawdown: null,
      assetMaxDrawdown: null,
      sharpe: null,
      sortino: null,
      calmar: null,
      beta: null,
      alpha: null,
      trackingError: null,
      informationRatio: null,
      riskFreeRate,
      periodsPerYear,
      dailyReturns: [],
    };
  }

  /**
   * 一站式取得序列 + 指標（dashboard / 分析頁用）
   */
  async getPerformance(userId, { from, to, benchmark = DEFAULT_BENCHMARK, riskFreeRate } = {}) {
    const series = await this.buildSeries(userId, { from, to, benchmark });
    const metrics = this.computeMetrics(series.days, {
      ...(riskFreeRate != null ? { riskFreeRate } : {}),
    });
    return {
      ...metrics,
      benchmark,
      benchmarks: BENCHMARKS,
      missingPriceSymbols: series.missingPriceSymbols,
      series: series.days.map((d) => ({
        date: d.date,
        totalAssets: d.totalAssets,
        cash: d.cash,
        positionValue: d.positionValue,
        netFlow: d.netFlow,
        twrIndex: round(d.twrIndex, 6),
        benchmarkClose: d.benchmarkClose,
      })),
    };
  }

  /**
   * 現金餘額（可指定 asOf，用於歷史快照）
   * cashBalance = cashAdjustment + 入金 - 出金 - 買入(含手續費) + 賣出(扣手續費與稅)
   */
  async computeCash(userId, asOf = null) {
    const iso = asOf ? toIso(asOf) : null;
    const ledger = await this._loadLedger(userId);
    let cash = ledger.cashAdjustment;
    for (const t of ledger.txns) {
      if (iso && t.date > iso) break;
      cash += t.type === 'deposit' ? t.amount : -t.amount;
    }
    for (const f of ledger.fills) {
      if (iso && f.date > iso) break;
      const gross = f.shares * f.price;
      if (f.action === 'buy') cash -= gross + f.fee;
      else if (f.action === 'sell') cash += gross - f.fee - f.tax;
    }
    return Math.round(cash);
  }

  /**
   * 評價持倉（市值、成本、未實現損益）
   *
   * @param {string} userId
   * @param {string|null} asOf ISO 日期；null = 用最新快取收盤價（不打外部 API）
   */
  async getValuation(userId, asOf = null) {
    const iso = asOf ? toIso(asOf) : null;

    if (!iso) {
      // 現在：直接用 Trade 上維護好的持倉統計 + 最新收盤價
      const openTrades = await prisma.trade.findMany({
        where: { userId, status: 'open' },
        select: {
          symbol: true,
          direction: true,
          totalShares: true,
          avgPrice: true,
          totalValue: true,
        },
      });
      const latest = await StockPriceService.getLatest(openTrades.map((t) => t.symbol));
      return this._valuePositions(
        openTrades.map((t) => ({
          symbol: t.symbol,
          direction: t.direction,
          shares: t.totalShares || 0,
          avgCost: t.avgPrice != null ? Number(t.avgPrice) : null,
          close: latest[t.symbol]?.close ?? null,
          priceDate: latest[t.symbol]?.date ?? null,
        })),
        await this.computeCash(userId)
      );
    }

    // 歷史某一天：從成交重放持倉與平均成本，價格取該日（含）之前最近的收盤
    const ledger = await this._loadLedger(userId);
    const book = new Map(); // symbol -> { shares, totalCost, lastPrice }
    for (const f of ledger.fills) {
      if (f.date > iso) break;
      if (!f.symbol) continue;
      const cur = book.get(f.symbol) || { shares: 0, totalCost: 0, lastPrice: null };
      const gross = f.shares * f.price;
      if (f.action === 'buy') {
        cur.shares += f.shares;
        cur.totalCost += gross + f.fee;
      } else if (f.action === 'sell') {
        const avg = cur.shares > 0 ? cur.totalCost / cur.shares : f.price;
        const qty = Math.min(f.shares, cur.shares);
        cur.shares -= qty;
        cur.totalCost -= qty * avg;
        if (cur.shares === 0) cur.totalCost = 0;
      }
      cur.lastPrice = f.price;
      book.set(f.symbol, cur);
    }

    const rows = await Promise.all(
      [...book.entries()]
        .filter(([, v]) => v.shares !== 0)
        .map(async ([symbol, v]) => {
          const close = await StockPriceService.getCloseOn(symbol, iso);
          return {
            symbol,
            direction: 'long',
            shares: v.shares,
            avgCost: v.shares > 0 ? v.totalCost / v.shares : null,
            close: close ?? v.lastPrice,
            priceDate: close != null ? iso : null,
          };
        })
    );

    return this._valuePositions(rows, await this.computeCash(userId, iso));
  }

  _valuePositions(rows, cashBalance) {
    let marketValue = 0;
    let costValue = 0;
    const missingPriceSymbols = [];

    const positions = rows
      .filter((r) => r.shares)
      .map((r) => {
        const sign = r.direction === 'short' ? -1 : 1;
        const cost = (r.avgCost ?? 0) * r.shares;
        if (r.close == null) missingPriceSymbols.push(r.symbol);

        // 沒有收盤價時退回成本，並標記為未定價，避免默默算成 0
        const mv = (r.close != null ? r.close : (r.avgCost ?? 0)) * r.shares * sign;
        const costSigned = cost * sign;
        marketValue += mv;
        costValue += costSigned;

        return {
          symbol: r.symbol,
          direction: r.direction,
          shares: r.shares,
          avgPrice: r.avgCost != null ? round(r.avgCost, 2) : null,
          currentPrice: r.close,
          priceDate: r.priceDate ?? null,
          marketValue: Math.round(mv),
          unrealizedPnL: Math.round(mv - costSigned),
        };
      });

    const mv = Math.round(marketValue);
    const cv = Math.round(costValue);
    return {
      cashBalance,
      marketValue: mv,
      costValue: cv,
      unrealizedPnL: mv - cv,
      totalAssets: cashBalance + mv,
      positions,
      missingPriceSymbols: [...new Set(missingPriceSymbols)],
    };
  }

  /**
   * 用收盤市值重算並覆寫 [from, to] 的每日快照
   * 這是歷史回填（option a）的實作：整段重算，而不是只往後生效
   */
  async rebuildSnapshots(userId, { from, to, allowFetch = false, replaceRange = false } = {}) {
    const series = await this.buildSeries(userId, { from, to, allowFetch });
    if (series.days.length === 0) {
      return { written: 0, deleted: 0, from: series.from, to: series.to, missingPriceSymbols: [] };
    }

    const rows = series.days.map((d) => ({
      userId,
      date: new Date(`${d.date}T00:00:00.000Z`),
      cashBalance: d.cash,
      positionValue: d.positionValue,
      totalAssets: d.totalAssets,
    }));

    let deleted = 0;

    if (replaceRange) {
      // 整段覆寫：舊快照有些落在非交易日、且數值是用成本算的，留著只會污染序列
      const res = await prisma.balanceSnapshot.deleteMany({
        where: {
          userId,
          date: { gte: rows[0].date, lte: rows[rows.length - 1].date },
        },
      });
      deleted = res.count;
      await prisma.balanceSnapshot.createMany({ data: rows });
    } else {
      for (const row of rows) {
        await prisma.balanceSnapshot.upsert({
          where: { userId_date: { userId, date: row.date } },
          update: {
            cashBalance: row.cashBalance,
            positionValue: row.positionValue,
            totalAssets: row.totalAssets,
          },
          create: row,
        });
      }
    }

    return {
      written: rows.length,
      deleted,
      from: series.days[0].date,
      to: series.days[series.days.length - 1].date,
      missingPriceSymbols: series.missingPriceSymbols,
    };
  }
}

export default new EquityService();
