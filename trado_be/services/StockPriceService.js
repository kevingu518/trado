import prisma from '../config/database.js';
import { fetchTwseMonth } from './stockSources/twseSource.js';
import { fetchTpexMonth } from './stockSources/tpexSource.js';

// 列出某 symbol 在 [startIso, endIso] 區間涵蓋的所有月份首日 YYYYMMDD
const enumerateMonths = (startIso, endIso) => {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const out = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    out.push(`${y}${m}01`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 從外部資料源抓某 symbol 在指定月份的資料。
 * 先 TWSE，找不到再 TPEX。回傳 { source, rows }；都找不到 → { source: null, rows: [] }
 */
const fetchMonthFromSource = async (symbol, yyyymmdd) => {
  const twse = await fetchTwseMonth(symbol, yyyymmdd);
  if (twse.found) return { source: 'TWSE', rows: twse.rows };

  const tpex = await fetchTpexMonth(symbol, yyyymmdd);
  if (tpex.found) return { source: 'TPEX', rows: tpex.rows };

  return { source: null, rows: [] };
};

/**
 * 確認某 symbol 在 [startIso, endIso] 區間的資料都在 DB 裡，若有缺則打外部 API 補齊。
 * @returns {Promise<Array<{ date, open, high, low, close, volume, source }>>}
 */
const ensureRangeCached = async (symbol, startIso, endIso) => {
  // 先撈現有 DB 資料
  const existing = await prisma.stockPrice.findMany({
    where: {
      symbol,
      date: { gte: new Date(startIso), lte: new Date(endIso) },
    },
    orderBy: { date: 'asc' },
  });

  // 算出 DB 已涵蓋的月份集合（粒度：月）。某月只要 DB 有任何一筆，就視為已 cache 該月，不再回頭打外部 API。
  // 這個策略不是「逐日比對」，理由：
  //  1. 假日/休市不在資料裡，逐日比對會永遠認為「有缺」
  //  2. 外部 API 本來就是月為單位，再抓一次成本一樣
  const cachedMonths = new Set(
    existing.map((r) => {
      const d = r.date;
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${y}${m}`;
    })
  );

  const allMonths = enumerateMonths(startIso, endIso); // YYYYMM01
  const missingMonths = allMonths.filter((q) => !cachedMonths.has(q.slice(0, 6)));

  if (missingMonths.length === 0) {
    return existing;
  }

  // 先以該 symbol 任一筆既有資料判斷 source（避免每次都先打 TWSE 失敗再打 TPEX）
  let knownSource = existing[0]?.source || null;

  for (let i = 0; i < missingMonths.length; i++) {
    const month = missingMonths[i];
    try {
      let result;
      if (knownSource === 'TWSE') {
        const twse = await fetchTwseMonth(symbol, month);
        result = twse.found ? { source: 'TWSE', rows: twse.rows } : await fetchMonthFromSource(symbol, month);
      } else if (knownSource === 'TPEX') {
        const tpex = await fetchTpexMonth(symbol, month);
        result = tpex.found ? { source: 'TPEX', rows: tpex.rows } : await fetchMonthFromSource(symbol, month);
      } else {
        result = await fetchMonthFromSource(symbol, month);
      }

      if (result.source && result.rows.length > 0) {
        knownSource = result.source;
        const data = result.rows.map((r) => ({
          symbol,
          date: new Date(r.date),
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: BigInt(r.volume || 0),
          source: result.source,
        }));
        // upsert by (symbol, date) — 用 createMany + skipDuplicates 速度比逐筆 upsert 快
        await prisma.stockPrice.createMany({ data, skipDuplicates: true });
      }
    } catch (err) {
      console.warn(`[StockPriceService] fetch ${symbol} ${month} failed:`, err.message);
    }
    if (i < missingMonths.length - 1) await sleep(250); // 節流：對 TWSE/TPEX 客氣一點
  }

  // 補完後重新撈
  return prisma.stockPrice.findMany({
    where: {
      symbol,
      date: { gte: new Date(startIso), lte: new Date(endIso) },
    },
    orderBy: { date: 'asc' },
  });
};

const toIso = (d) => d.toISOString().slice(0, 10);

const serialize = (rows) =>
  rows.map((r) => ({
    date: toIso(r.date),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: typeof r.volume === 'bigint' ? Number(r.volume) : r.volume,
    source: r.source,
  }));

class StockPriceService {
  /**
   * 取 symbol 在 [start, end] 區間的 K 線；DB 沒有的部分自動 lazy backfill
   */
  async getKlineRange(symbol, start, end) {
    if (!symbol) throw new Error('symbol is required');
    const rows = await ensureRangeCached(symbol, start, end);
    return serialize(rows);
  }

  /**
   * 取多支股票的「最新」收盤價（不會打外部，純 DB read）
   * @param {string[]} symbols
   * @returns {Promise<Object>} { [symbol]: { date, close } | null }
   */
  async getLatest(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return {};
    // 對每個 symbol 撈最新一筆。symbol 數量通常 < 100，逐個 query 簡單清楚
    const results = await Promise.all(
      symbols.map((s) =>
        prisma.stockPrice.findFirst({
          where: { symbol: s },
          orderBy: { date: 'desc' },
        })
      )
    );
    const out = {};
    for (let i = 0; i < symbols.length; i++) {
      const r = results[i];
      out[symbols[i]] = r
        ? { date: toIso(r.date), close: Number(r.close), source: r.source }
        : null;
    }
    return out;
  }

  /**
   * 拿單一 symbol 在指定日期（含或之前最近）的收盤價（用於對歷史日做估值）
   */
  async getCloseOn(symbol, isoDate) {
    const r = await prisma.stockPrice.findFirst({
      where: { symbol, date: { lte: new Date(isoDate) } },
      orderBy: { date: 'desc' },
    });
    return r ? Number(r.close) : null;
  }

  /**
   * 給定一組 symbols，抓最新月份的資料寫入 DB（給 cron job 用）
   */
  async refreshTodayPrices(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) return { ok: 0, fail: 0 };
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const monthYyyymmdd = `${y}${m}01`;

    let ok = 0;
    let fail = 0;
    for (const symbol of symbols) {
      try {
        const result = await fetchMonthFromSource(symbol, monthYyyymmdd);
        if (result.source && result.rows.length > 0) {
          await prisma.stockPrice.createMany({
            data: result.rows.map((r) => ({
              symbol,
              date: new Date(r.date),
              open: r.open,
              high: r.high,
              low: r.low,
              close: r.close,
              volume: BigInt(r.volume || 0),
              source: result.source,
            })),
            skipDuplicates: true,
          });
          ok++;
        } else {
          fail++;
        }
      } catch (err) {
        console.warn(`[StockPriceService] refresh ${symbol} failed:`, err.message);
        fail++;
      }
      await sleep(250);
    }
    return { ok, fail };
  }
}

export default new StockPriceService();
