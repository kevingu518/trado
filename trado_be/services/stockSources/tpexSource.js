/**
 * TPEX (上櫃, 櫃買中心) 資料來源
 * Endpoint: https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock
 *  - date 是西元年斜線：YYYY/MM/DD
 *  - 一個 call 回**整個月**
 *  - 回傳 { tables: [{ data: [[date, vol, money, open, high, low, close, change, count]] }] }
 *  - 不開 CORS（這就是為什麼前端打不到的原因）
 */

const ENDPOINT = 'https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock';

const num = (s) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

// "115/05/04" → "2026-05-04"
const parseRocDate = (s) => {
  const parts = String(s).split('/');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const yi = parseInt(y, 10);
  if (isNaN(yi)) return null;
  const year = yi < 200 ? 1911 + yi : yi;
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const parseRow = (row) => {
  if (!Array.isArray(row) || row.length < 7) return null;
  const date = parseRocDate(row[0]);
  if (!date) return null;
  return {
    date,
    volume: Math.trunc(num(row[1])),
    open: num(row[3]),
    high: num(row[4]),
    low: num(row[5]),
    close: num(row[6]),
  };
};

// YYYYMMDD → YYYY/MM/DD (TPEX 要西元年斜線)
const toSlashDate = (yyyymmdd) =>
  `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;

/**
 * @param {string} symbol e.g. "6488"
 * @param {string} yyyymmdd 該月任一天
 * @returns {Promise<{ found: boolean, rows: Array }>}
 */
export const fetchTpexMonth = async (symbol, yyyymmdd) => {
  const url = `${ENDPOINT}?code=${symbol}&date=${toSlashDate(yyyymmdd)}&id=&response=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`TPEX ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const table = Array.isArray(data?.tables) ? data.tables[0] : null;
  const raw = table?.data;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { found: false, rows: [] };
  }
  const rows = raw.map(parseRow).filter(Boolean);
  return { found: rows.length > 0, rows };
};

/**
 * 上櫃除權除息（僅當日）
 * Endpoint: https://www.tpex.org.tw/openapi/v1/tpex_exright_daily
 *  - 櫃買中心的 OpenAPI 只提供「當日」除權息，沒有日期區間參數，
 *    所以上櫃的歷史還原係數無法回補，只能從上線日起每天抓一次慢慢累積
 *  - Date 是民國年無斜線："1151105"
 */
const EX_RIGHT_DAILY_ENDPOINT = 'https://www.tpex.org.tw/openapi/v1/tpex_exright_daily';

// "1151105" → "2026-11-05"
const parseRocCompact = (s) => {
  const v = String(s || '').trim();
  if (!/^\d{7}$/.test(v)) return null;
  const y = parseInt(v.slice(0, 3), 10);
  if (isNaN(y)) return null;
  return `${1911 + y}-${v.slice(3, 5)}-${v.slice(5, 7)}`;
};

/**
 * @returns {Promise<Array<{symbol, exDate, preClose, refPrice, kind, cashDividend, stockRatio}>>}
 */
export const fetchTpexExRightToday = async () => {
  const res = await fetch(EX_RIGHT_DAILY_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`TPEX exRight ${res.status} ${res.statusText}`);
  }
  const list = await res.json();
  if (!Array.isArray(list)) return [];

  return list
    .map((r) => {
      const exDate = parseRocCompact(r.Date);
      const symbol = String(r.SecuritiesCompanyCode || '').trim();
      const preClose = num(r.ClosePriceBeforeExRightsDiviend);
      const refPrice = num(r.ExRightsDiviendQuote);
      if (!exDate || !symbol || preClose <= 0 || refPrice <= 0) return null;
      return {
        symbol,
        exDate,
        preClose,
        refPrice,
        kind: String(r.ExRightsDiviend || '').replace(/^除/, '').trim() || '息',
        cashDividend: num(r.CashDividend) || null,
        stockRatio: num(r.StockDividend) || null,
      };
    })
    .filter(Boolean);
};
