/**
 * TWSE (上市) 資料來源
 * Endpoint: https://www.twse.com.tw/exchangeReport/STOCK_DAY
 *  - 一個 call 回**整個月**的資料
 *  - 民國年 + 千分位逗號需要轉換
 *  - 非上市股票會回 { stat: "很抱歉，沒有符合條件的資料!" }
 */

const ENDPOINT = 'https://www.twse.com.tw/exchangeReport/STOCK_DAY';

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

/**
 * @param {string} symbol e.g. "2330"
 * @param {string} yyyymmdd 該月任一天 (用來指定月份)
 * @returns {Promise<{ found: boolean, rows: Array }>}
 *   - found=true：表示是上市股票（stat==='OK'）
 *   - found=false：上市查無資料（可能是上櫃、興櫃，或符號錯誤）
 */
export const fetchTwseMonth = async (symbol, yyyymmdd) => {
  const url = `${ENDPOINT}?response=json&date=${yyyymmdd}&stockNo=${symbol}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`TWSE ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.stat !== 'OK') {
    return { found: false, rows: [] };
  }
  const rows = (data.data || []).map(parseRow).filter(Boolean);
  return { found: true, rows };
};
