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
