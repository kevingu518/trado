import prisma from '../config/database.js';
import StockPriceService from './StockPriceService.js';
import { AppError } from '../errors/index.js';

/**
 * 盤後日誌
 *
 * 設計重點：
 *  - 每個使用者每個交易日最多一筆（DB 用 (userId, tradeDate) unique 保證）
 *  - 「交易日」的定義是 TAIEX 有收盤價的日期（與 EquityService 的交易日曆一致）
 *  - 隔日漲跌、20 日年化波動度都在讀取時即時算，不落庫、不評分
 *  - 補寫（backfilled）：建立時間晚於次一交易日 09:00（Asia/Taipei）才寫的
 */

const SYMBOL = 'TAIEX';
const VIEWS = new Set(['bull', 'neutral', 'bear']);
const VOL_RETURN_COUNT = 20; // 20 個日報酬 → 需要 21 個收盤價
const TRADING_DAYS_PER_YEAR = 252;
const TAIPEI_TZ = 'Asia/Taipei';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toIso = (d) => d.toISOString().slice(0, 10);
const toDbDate = (iso) => new Date(`${iso}T00:00:00.000Z`);
const addDaysIso = (iso, days) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
};

/** 現在的台北日期（YYYY-MM-DD） */
const taipeiTodayIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TAIPEI_TZ }).format(new Date());

const assertIsoDate = (value, field = 'date') => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new AppError(`${field} must be YYYY-MM-DD`, 400);
  }
  return value;
};

const num = (v) => (v == null ? null : Number(v));

const serializeEntry = (row) =>
  row
    ? {
        id: row.id,
        tradeDate: toIso(row.tradeDate),
        view: row.view,
        summary: row.summary,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;

/**
 * 20 日年化波動度：近 20 個日對數報酬的樣本標準差 × sqrt(252)
 * 收盤價不足 21 筆回 null（不要用 0 假裝算得出來）
 */
const annualizedVolatility = (closes) => {
  if (!Array.isArray(closes) || closes.length < VOL_RETURN_COUNT + 1) return null;
  const window = closes.slice(-(VOL_RETURN_COUNT + 1));
  const returns = [];
  for (let i = 1; i < window.length; i += 1) {
    if (window[i - 1] <= 0 || window[i] <= 0) return null;
    returns.push(Math.log(window[i] / window[i - 1]));
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
};

class MarketJournalService {
  /** 取 TAIEX 在區間內有收盤價的日期（＝交易日曆） */
  async _tradingRows(fromIso, toIsoDate) {
    return prisma.stockPrice.findMany({
      where: {
        symbol: SYMBOL,
        date: { gte: toDbDate(fromIso), lte: toDbDate(toIsoDate) },
      },
      orderBy: { date: 'asc' },
      select: { date: true, close: true, volume: true, turnover: true },
    });
  }

  /**
   * 確保某天的 TAIEX 收盤資料已在 DB（月份快取沒涵蓋時會打 TWSE）。
   * 回傳該日資料或 null（休市 / 抓不到）。
   */
  async _ensureDay(isoDate) {
    try {
      await StockPriceService.getKlineRange(SYMBOL, isoDate, isoDate);
    } catch (err) {
      // 外部資料源掛掉不該讓整個頁面 500；休市判斷交給後續查庫
      console.warn(`[MarketJournalService] ensure ${isoDate} failed:`, err.message);
    }
    return prisma.stockPrice.findUnique({
      where: { symbol_date: { symbol: SYMBOL, date: toDbDate(isoDate) } },
    });
  }

  /** 某使用者某天的日誌 */
  _findEntry(userId, isoDate) {
    return prisma.marketJournal.findUnique({
      where: { userId_tradeDate: { userId, tradeDate: toDbDate(isoDate) } },
    });
  }

  /**
   * 把日誌列表補上「補寫」與隔日漲跌。
   * 交易日曆一次撈起來，避免逐筆查詢。
   */
  async _decorate(entries, fromIso, toIsoDate) {
    if (entries.length === 0) return [];

    const rows = await this._tradingRows(fromIso, addDaysIso(toIsoDate, 45));
    const closeByDate = new Map(rows.map((r) => [toIso(r.date), Number(r.close)]));
    const dates = rows.map((r) => toIso(r.date));

    return entries.map((entry) => {
      const iso = toIso(entry.tradeDate);
      const nextDate = dates.find((d) => d > iso) || null;
      const close = closeByDate.get(iso);
      const nextClose = nextDate ? closeByDate.get(nextDate) : null;

      // 次一交易日 09:00 之後才寫 → 補寫；還沒有次一交易日就退化成隔天 09:00
      const deadlineIso = nextDate || addDaysIso(iso, 1);
      const deadline = new Date(`${deadlineIso}T09:00:00+08:00`);

      return {
        ...serializeEntry(entry),
        backfilled: entry.createdAt > deadline,
        nextDate,
        nextChange: close != null && nextClose != null ? nextClose - close : null,
        nextChangePct:
          close != null && nextClose != null && close !== 0
            ? (nextClose - close) / close
            : null,
      };
    });
  }

  /**
   * GET /api/journal?from&to
   * 只回有寫的日誌；交易日曆與隔日漲跌由這裡補齊
   */
  async list(userId, { from, to } = {}) {
    const toIsoDate = assertIsoDate(to || taipeiTodayIso(), 'to');
    const fromIso = assertIsoDate(from || addDaysIso(toIsoDate, -120), 'from');
    if (fromIso > toIsoDate) throw new AppError('from must be <= to', 400);

    const entries = await prisma.marketJournal.findMany({
      where: {
        userId,
        tradeDate: { gte: toDbDate(fromIso), lte: toDbDate(toIsoDate) },
      },
      orderBy: { tradeDate: 'desc' },
    });

    return this._decorate(entries, fromIso, toIsoDate);
  }

  /**
   * GET /api/journal/context?date=
   * 表單上方要顯示的當日大盤數字＋既有日誌＋前一篇日誌
   */
  async getContext(userId, dateIso) {
    const iso = assertIsoDate(dateIso);
    if (iso > taipeiTodayIso()) {
      return {
        isTradingDay: false,
        tradeDate: iso,
        market: null,
        entry: null,
        prevEntry: null,
      };
    }

    const day = await this._ensureDay(iso);
    const entry = await this._findEntry(userId, iso);
    const prevRow = await prisma.marketJournal.findFirst({
      where: { userId, tradeDate: { lt: toDbDate(iso) } },
      orderBy: { tradeDate: 'desc' },
    });

    if (!day) {
      return {
        isTradingDay: false,
        tradeDate: iso,
        market: null,
        entry: serializeEntry(entry),
        prevEntry: serializeEntry(prevRow),
      };
    }

    const [prevDay, recent] = await Promise.all([
      prisma.stockPrice.findFirst({
        where: { symbol: SYMBOL, date: { lt: toDbDate(iso) } },
        orderBy: { date: 'desc' },
        select: { date: true, close: true },
      }),
      prisma.stockPrice.findMany({
        where: { symbol: SYMBOL, date: { lte: toDbDate(iso) } },
        orderBy: { date: 'desc' },
        take: VOL_RETURN_COUNT + 1,
        select: { close: true },
      }),
    ]);

    const close = Number(day.close);
    const prevClose = prevDay ? Number(prevDay.close) : null;
    // 指數點數到小數兩位就好；浮點誤差不要漏到 API
    const change = prevClose == null ? null : Number((close - prevClose).toFixed(2));
    const changePct =
      prevClose == null ? null : Number(((close - prevClose) / prevClose).toFixed(6));
    const closes = recent.map((r) => Number(r.close)).reverse();

    return {
      isTradingDay: true,
      tradeDate: iso,
      market: {
        close,
        change,
        changePct,
        volume: num(day.volume),
        turnover: num(day.turnover),
        volatility20: annualizedVolatility(closes),
      },
      entry: serializeEntry(entry),
      prevEntry: serializeEntry(prevRow),
    };
  }

  /**
   * PUT /api/journal/:date — 同一天重複儲存是更新，不會產生第二筆
   */
  async upsert(userId, dateIso, payload = {}) {
    const iso = assertIsoDate(dateIso);
    const view = typeof payload.view === 'string' ? payload.view.trim() : '';
    const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
    const bodyRaw = typeof payload.body === 'string' ? payload.body : '';
    const body = bodyRaw.trim() ? bodyRaw : null;

    if (!VIEWS.has(view)) {
      throw new AppError('view must be one of bull / neutral / bear', 400);
    }
    if (!summary) {
      throw new AppError('summary is required', 400);
    }
    if (summary.length > 100) {
      throw new AppError('summary must be at most 100 characters', 400);
    }
    if (body && body.length > 20000) {
      throw new AppError('body is too long (max 20000 characters)', 400);
    }
    if (iso > taipeiTodayIso()) {
      throw new AppError('不可建立未來日期的日誌', 400);
    }

    const day = await this._ensureDay(iso);
    if (!day) {
      throw new AppError('今天休市，無法建立盤後日誌', 400);
    }

    const entry = await prisma.marketJournal.upsert({
      where: { userId_tradeDate: { userId, tradeDate: toDbDate(iso) } },
      create: { userId, tradeDate: toDbDate(iso), view, summary, body },
      update: { view, summary, body },
    });

    return serializeEntry(entry);
  }

  /** DELETE /api/journal/:date */
  async remove(userId, dateIso) {
    const iso = assertIsoDate(dateIso);
    const result = await prisma.marketJournal.deleteMany({
      where: { userId, tradeDate: toDbDate(iso) },
    });
    return { deleted: result.count };
  }
}

export default new MarketJournalService();
