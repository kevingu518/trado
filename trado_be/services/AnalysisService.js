import EquityService, {
  DEFAULT_RISK_FREE_RATE,
  TRADING_DAYS_PER_YEAR,
} from './EquityService.js';
import { BENCHMARKS, DEFAULT_BENCHMARK } from '../utils/benchmarks.js';

/**
 * 分析頁（tearsheet）
 *
 * 這一層只把既有的每日序列「換成畫圖用的形狀」，不重新計算績效指標：
 * 報酬、波動、Sharpe 一律沿用 EquityService.computeMetrics，
 * 否則儀表板與分析頁會對同一個帳號給出兩個不同的 Sharpe，比沒有還糟。
 *
 * 所有曲線都以 TWR 指數（已排除出入金）為基礎。若改用 totalAssets，
 * 使用者補一筆錢就會被看成一段獲利，這是績效曲線最常見的誤導。
 */

const sum = (arr) => arr.reduce((s, x) => s + x, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

// 樣本標準差（除以 n-1），與 EquityService 的 Sharpe 定義一致
const stdev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map((x) => (x - m) ** 2)) / (arr.length - 1));
};

const round = (n, digits) => (n == null || Number.isNaN(n) ? null : Number(n.toFixed(digits)));

// 滾動視窗 60 個交易日 ≈ 一季。比 20 天長，Sharpe 才不會被幾筆大單主導；
// 但資料不足時就整段不畫，不要用短視窗硬撐出鋸齒狀的假訊號。
export const ROLLING_WINDOW = 60;

/** 日報酬序列；第 0 天沒有前一日，固定為 null（不是 0） */
const dailyReturns = (days) => {
  const out = [null];
  for (let i = 1; i < days.length; i += 1) {
    const prev = days[i - 1].twrIndex;
    const cur = days[i].twrIndex;
    out.push(prev > 0 ? cur / prev - 1 : null);
  }
  return out;
};

/** 兩條線都正規化成 100，方便疊在同一張圖比累積報酬 */
const buildEquity = (days) => {
  if (days.length === 0) return [];
  const baseTwr = days[0].twrIndex || 1;
  const firstBench = days.find((d) => d.benchmarkClose != null)?.benchmarkClose ?? null;
  return days.map((d) => ({
    date: d.date,
    portfolio: round((d.twrIndex / baseTwr) * 100, 2),
    benchmark:
      firstBench && d.benchmarkClose != null
        ? round((d.benchmarkClose / firstBench) * 100, 2)
        : null,
  }));
};

/** 回撤曲線（以 TWR 指數對前波高點計算，單位為比例，≤ 0） */
const buildDrawdown = (days) => {
  if (days.length === 0) return { curve: [], maxDrawdown: null, maxDrawdownDate: null };
  let peak = days[0].twrIndex;
  let mdd = 0;
  let mddDate = days[0].date;
  const curve = days.map((d) => {
    if (d.twrIndex > peak) peak = d.twrIndex;
    const dd = peak > 0 ? d.twrIndex / peak - 1 : 0;
    if (dd < mdd) {
      mdd = dd;
      mddDate = d.date;
    }
    return { date: d.date, drawdown: round(dd, 4) };
  });
  return { curve, maxDrawdown: round(mdd, 4), maxDrawdownDate: mddDate };
};

/**
 * 月報酬
 *
 * 基準點是「上一個月最後一個交易日的 TWR」而不是「本月第一天」，
 * 否則每個月第一天的漲跌會被吃掉。第一個月份沒有上月可銜接，
 * 就以當月第一天為基準（該月報酬因此從第二天起算）。
 */
const buildMonthly = (days) => {
  const rows = new Map();
  let prevTwr = null;
  let prevBench = null;

  for (const d of days) {
    const key = d.date.slice(0, 7);
    let row = rows.get(key);
    if (!row) {
      row = {
        year: Number(d.date.slice(0, 4)),
        month: Number(d.date.slice(5, 7)),
        baseTwr: prevTwr ?? d.twrIndex,
        baseBench: prevBench,
        lastTwr: d.twrIndex,
        lastBench: prevBench,
        tradingDays: 0,
      };
      rows.set(key, row);
    }
    row.lastTwr = d.twrIndex;
    row.tradingDays += 1;
    if (d.benchmarkClose != null) {
      row.lastBench = d.benchmarkClose;
      if (row.baseBench == null) row.baseBench = d.benchmarkClose; // 第一個月沒有上月收盤
    }
    prevTwr = d.twrIndex;
    if (d.benchmarkClose != null) prevBench = d.benchmarkClose;
  }

  return [...rows.values()].map((r) => ({
    year: r.year,
    month: r.month,
    label: `${r.year}-${String(r.month).padStart(2, '0')}`,
    return: r.baseTwr > 0 ? round(r.lastTwr / r.baseTwr - 1, 4) : null,
    benchmarkReturn:
      r.baseBench > 0 && r.lastBench != null ? round(r.lastBench / r.baseBench - 1, 4) : null,
    tradingDays: r.tradingDays,
  }));
};

/** 滾動 60 日：區間報酬、年化波動、年化 Sharpe */
const buildRolling = (days, rets, rfDaily) => {
  if (days.length <= ROLLING_WINDOW) return [];
  const out = [];
  for (let i = ROLLING_WINDOW; i < days.length; i += 1) {
    const win = rets.slice(i - ROLLING_WINDOW + 1, i + 1).filter((r) => r != null);
    // 視窗內有 null（前段缺價）時樣本不足 → 不輸出，避免用半個視窗冒充一季
    if (win.length < ROLLING_WINDOW) continue;
    const sd = stdev(win);
    const base = days[i - ROLLING_WINDOW].twrIndex;
    out.push({
      date: days[i].date,
      return: base > 0 ? round(days[i].twrIndex / base - 1, 4) : null,
      vol: sd > 0 ? round(sd * Math.sqrt(TRADING_DAYS_PER_YEAR), 4) : null,
      sharpe:
        sd > 0
          ? round(((mean(win) - rfDaily) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR), 2)
          : null,
    });
  }
  return out;
};

const buildMonthlySummary = (monthly) => {
  const valid = monthly.filter((m) => m.return != null);
  if (valid.length === 0) {
    return { months: 0, positiveMonths: 0, winRate: null, best: null, worst: null };
  }
  let best = valid[0];
  let worst = valid[0];
  for (const m of valid) {
    if (m.return > best.return) best = m;
    if (m.return < worst.return) worst = m;
  }
  const positive = valid.filter((m) => m.return > 0).length;
  return {
    months: valid.length,
    positiveMonths: positive,
    winRate: round(positive / valid.length, 4),
    best: { label: best.label, return: best.return },
    worst: { label: worst.label, return: worst.return },
  };
};

class AnalysisService {
  /**
   * @param {object} opts
   * @param {string} [opts.from] YYYY-MM-DD，未給則從帳號第一筆活動起
   * @param {string} [opts.to]   YYYY-MM-DD
   * @param {string} [opts.benchmark] TAIEX | 0050（呼叫端需先以 isBenchmark 白名單過濾）
   */
  async getTearsheet(userId, {
    from,
    to,
    benchmark = DEFAULT_BENCHMARK,
    riskFreeRate = DEFAULT_RISK_FREE_RATE,
    allowFetch = false,
  } = {}) {
    // 只建一次序列：先前版本先呼叫 getPerformance、再 buildSeries 一次，
    // 等於整段價格查詢跑兩遍
    const series = await EquityService.buildSeries(userId, { from, to, benchmark, allowFetch });
    const days = series.days;
    const metrics = EquityService.computeMetrics(days, { riskFreeRate });

    const rets = dailyReturns(days);
    const drawdown = buildDrawdown(days);
    const monthly = buildMonthly(days);
    const rolling = buildRolling(days, rets, riskFreeRate / TRADING_DAYS_PER_YEAR);

    // MWR 一定是「自首筆活動」起算（資金加權要有完整的投入紀錄），
    // 不受頁面上的區間篩選影響；前端標籤要寫清楚，否則會跟 TWR 對不上
    const lastDay = days[days.length - 1];
    const mwr = lastDay
      ? await EquityService.computeXirr(userId, lastDay.totalAssets, lastDay.date)
      : null;

    return {
      meta: {
        from: metrics.from || series.from,
        to: metrics.to || series.to,
        benchmark,
        benchmarks: BENCHMARKS,
        observations: metrics.observations,
        rollingWindow: ROLLING_WINDOW,
        // XIRR 一律自首筆活動起算，不受頁面區間影響（見下方 metrics.xirr）
        mwrPeriod: 'since-inception',
        missingPriceSymbols: series.missingPriceSymbols,
      },
      // 給 KPI 卡片用；欄位與儀表板共用，兩頁不會對不上
      metrics: {
        totalReturn: metrics.totalReturn,
        xirr: mwr,
        annualizedReturn: metrics.annualizedReturn,
        marketReturn: metrics.marketReturn,
        excessReturn: metrics.excessReturn,
        volatility: metrics.volatility,
        maxDrawdown: metrics.maxDrawdown,
        sharpe: metrics.sharpe,
        sortino: metrics.sortino,
        calmar: metrics.calmar,
        beta: metrics.beta,
        alpha: metrics.alpha,
        trackingError: metrics.trackingError,
        informationRatio: metrics.informationRatio,
        sampleSufficient: metrics.sampleSufficient,
        annualizationSufficient: metrics.annualizationSufficient,
        minObservations: metrics.minObservations,
        minAnnualizedObservations: metrics.minAnnualizedObservations,
      },
      equity: buildEquity(days),
      drawdown: drawdown.curve,
      maxDrawdownDate: drawdown.maxDrawdownDate,
      monthly,
      monthlySummary: buildMonthlySummary(monthly),
      rolling,
    };
  }
}

export default new AnalysisService();
