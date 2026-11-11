import prisma from '../config/database.js';
import { fetchTwseExRightRange } from './stockSources/twseSource.js';
import { fetchTpexExRightToday } from './stockSources/tpexSource.js';

/**
 * 除權息還原（A6）
 *
 * 問題：StockPrice 存的是原始收盤價。除息日當天股價會扣掉股利，
 * 若直接用原始價算日報酬，每一次配息都會被記成一次「虧損」，
 * 台股一年殖利率 3~5%，等於系統性低估報酬，而且配得越多的股票看起來越差。
 *
 * 解法：用交易所公告的「除權息參考價 ÷ 除權息前收盤價」當還原係數，
 * 把除息日**之前**的價格乘上這個係數，序列在除息日就連續了；
 * 用還原價算出來的日報酬 = 把股利再投入的總報酬。
 *
 * 為什麼不自己用股利金額回推：減資、股票股利、現金增資認購價都會影響參考價，
 * 交易所算好的那一欄已經把這些都算進去了。
 *
 * 已知限制：櫃買中心 OpenAPI 只提供「當日」除權息，上櫃股票的歷史事件補不回來，
 * 只能從上線後每天抓、逐步累積（見 syncDaily）。
 */
class CorporateActionService {
  /**
   * 抓上市（TWSE）某段期間的除權息事件並寫入
   * @param {string} fromIso YYYY-MM-DD
   * @param {string} toIso   YYYY-MM-DD
   */
  async syncTwseRange(fromIso, toIso) {
    const events = await fetchTwseExRightRange(fromIso, toIso);
    const written = await this._upsertMany(events, 'TWSE');
    return { fetched: events.length, written };
  }

  /**
   * 抓上櫃（TPEX）當日除權息事件
   */
  async syncTpexToday() {
    const events = await fetchTpexExRightToday();
    const written = await this._upsertMany(events, 'TPEX');
    return { fetched: events.length, written };
  }

  /**
   * 每日排程用：上市補最近 N 天（改到參考價以公告為準，重抓成本低），
   * 上櫃只抓當日。
   */
  async syncDaily({ lookbackDays = 7 } = {}) {
    const to = new Date();
    const from = new Date(to.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const iso = (d) => d.toISOString().slice(0, 10);
    const result = { twse: null, tpex: null, errors: [] };

    try {
      result.twse = await this.syncTwseRange(iso(from), iso(to));
    } catch (err) {
      result.errors.push(`TWSE: ${err.message}`);
    }
    try {
      result.tpex = await this.syncTpexToday();
    } catch (err) {
      result.errors.push(`TPEX: ${err.message}`);
    }
    return result;
  }

  async _upsertMany(events, source) {
    if (!events || events.length === 0) return 0;

    // 同一個 symbol + exDate 只留一筆（交易所偶有重複列，例如同一天兩段公告）
    const dedup = new Map();
    for (const e of events) {
      const factor = e.refPrice / e.preClose;
      if (!Number.isFinite(factor) || factor <= 0 || factor > 2) continue; // 壞資料防護
      dedup.set(`${e.symbol}|${e.exDate}`, {
        symbol: e.symbol,
        exDate: new Date(`${e.exDate}T00:00:00.000Z`),
        preClose: e.preClose,
        refPrice: e.refPrice,
        factor,
        kind: e.kind || '息',
        cashDividend: e.cashDividend ?? null,
        stockRatio: e.stockRatio ?? null,
        source,
      });
    }
    const rows = [...dedup.values()];

    let written = 0;
    // createMany + upsert 無法一次做，分批 transaction 內 upsert
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await prisma.$transaction(
        chunk.map((r) =>
          prisma.corporateAction.upsert({
            where: { symbol_exDate: { symbol: r.symbol, exDate: r.exDate } },
            create: r,
            update: {
              preClose: r.preClose,
              refPrice: r.refPrice,
              factor: r.factor,
              kind: r.kind,
              cashDividend: r.cashDividend,
              stockRatio: r.stockRatio,
              source: r.source,
            },
          })
        )
      );
      written += chunk.length;
    }
    return written;
  }

  /**
   * 取多個 symbol 在某段期間內的還原事件
   * @returns {Promise<Map<string, Array<{exDate: string, factor: number}>>>}
   */
  async getActionsForSymbols(symbols, fromIso, toIso) {
    const uniq = [...new Set((symbols || []).filter(Boolean))];
    const out = new Map(uniq.map((s) => [s, []]));
    if (uniq.length === 0) return out;

    const rows = await prisma.corporateAction.findMany({
      where: {
        symbol: { in: uniq },
        exDate: { gt: new Date(fromIso), lte: new Date(toIso) },
      },
      select: { symbol: true, exDate: true, factor: true },
      orderBy: { exDate: 'asc' },
    });

    for (const r of rows) {
      out.get(r.symbol)?.push({
        exDate: r.exDate.toISOString().slice(0, 10),
        factor: Number(r.factor),
      });
    }
    return out;
  }
}

/**
 * 把除權息還原套到價格序列上（純函式，方便單獨驗算）
 *
 * @param {Array<{date: string, close: number}>} rows 升冪
 * @param {Array<{exDate: string, factor: number}>} actions 升冪
 * @returns {Array<{date: string, close: number, adjClose: number}>}
 *
 * 規則：某一天 d 的還原價 = 原始價 × Π(所有 exDate > d 的 factor)。
 * 也就是「除息日之後」的價格不動，除息日之前的價格往下調，
 * 讓跨越除息日的那一根 K 棒不會憑空出現缺口。
 */
export const applyCorporateActions = (rows, actions) => {
  if (!rows || rows.length === 0) return [];
  if (!actions || actions.length === 0) {
    return rows.map((r) => ({ ...r, adjClose: r.close }));
  }

  const sorted = [...actions].sort((a, b) => (a.exDate < b.exDate ? -1 : 1));
  const out = new Array(rows.length);
  let k = sorted.length - 1;
  let cum = 1; // 目前日期所套用的累積係數

  // 由後往前掃：走過某個 exDate 之後，把該事件之前的係數乘進去
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const day = rows[i].date;
    while (k >= 0 && sorted[k].exDate > day) {
      cum *= sorted[k].factor;
      k -= 1;
    }
    out[i] = { ...rows[i], adjClose: rows[i].close * cum };
  }
  return out;
};

export default new CorporateActionService();
