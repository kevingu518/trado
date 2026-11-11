/**
 * TWSE (上市) 資料來源
 * Endpoint: https://www.twse.com.tw/exchangeReport/STOCK_DAY
 *  - 一個 call 回**整個月**的資料
 *  - 民國年 + 千分位逗號需要轉換
 *  - 非上市股票會回 { stat: "很抱歉，沒有符合條件的資料!" }
 */

const ENDPOINT = 'https://www.twse.com.tw/exchangeReport/STOCK_DAY';

/**
 * TAIEX（發行量加權股價指數）
 * Endpoint: https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK
 *  - 一次回整個月的「市場成交資訊」，沒有 stockNo 參數
 *  - 第 5 欄（index 4）是當日收盤指數
 *  - 只提供收盤值，沒有 OHLC：open/high/low 一律帶入收盤，
 *    避免下游拿到 0 而算出假的振幅
 *  - volume 是全市場成交股數，不是指數本身的量，因此存 0
 */
const INDEX_ENDPOINT = 'https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK';

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

const parseIndexRow = (row) => {
  if (!Array.isArray(row) || row.length < 5) return null;
  const date = parseRocDate(row[0]);
  const close = num(row[4]);
  if (!date || !close) return null;
  return { date, open: close, high: close, low: close, close, volume: 0 };
};

/**
 * 取某個月的大盤加權指數收盤值
 * @param {string} yyyymmdd 該月任一天 (用來指定月份)
 * @returns {Promise<{ found: boolean, rows: Array }>}
 */
export const fetchTwseIndexMonth = async (yyyymmdd) => {
  const url = `${INDEX_ENDPOINT}?response=json&date=${yyyymmdd}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`TWSE index ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.stat !== 'OK') {
    return { found: false, rows: [] };
  }
  const rows = (data.data || []).map(parseIndexRow).filter(Boolean);
  return { found: true, rows };
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

/**
 * 除權除息計算結果表（上市）
 * Endpoint: https://www.twse.com.tw/rwd/zh/exRight/TWT49U
 *  - 一次回一個日期區間（實測 2026 全年 1400 筆沒問題）
 *  - 交易所直接給「除權息前收盤價」與「除權息參考價」，
 *    還原係數 = 參考價 ÷ 前收盤價，不必自己用股利回推
 *  - 上櫃股票不在這張表（要另外走 TPEX）
 */
const EX_RIGHT_ENDPOINT = 'https://www.twse.com.tw/rwd/zh/exRight/TWT49U';

// "115年07月01日" → "2026-07-01"
const parseRocCnDate = (s) => {
  const m = String(s || '').match(/^(\d{2,3})年(\d{1,2})月(\d{1,2})日$/);
  if (!m) return null;
  const yi = parseInt(m[1], 10);
  const year = yi < 200 ? 1911 + yi : yi;
  return `${year}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
};

/**
 * @param {string} startIso YYYY-MM-DD
 * @param {string} endIso   YYYY-MM-DD
 * @returns {Promise<Array<{symbol, exDate, preClose, refPrice, kind, cashDividend, stockRatio}>>}
 */
export const fetchTwseExRightRange = async (startIso, endIso) => {
  const compact = (iso) => iso.replace(/-/g, '');
  const url = `${EX_RIGHT_ENDPOINT}?response=json&startDate=${compact(startIso)}&endDate=${compact(endIso)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`TWSE exRight ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.stat !== 'OK') return [];

  // 欄位：0 資料日期 1 股票代號 3 除權息前收盤價 4 除權息參考價 6 權/息
  return (data.data || [])
    .map((row) => {
      if (!Array.isArray(row) || row.length < 7) return null;
      // 這張表的日期是「115年07月01日」，跟 STOCK_DAY 的「115/07/01」不同格式
      const exDate = parseRocCnDate(row[0]);
      const symbol = String(row[1] || '').trim();
      const preClose = num(row[3]);
      const refPrice = num(row[4]);
      if (!exDate || !symbol || preClose <= 0 || refPrice <= 0) return null;
      return {
        symbol,
        exDate,
        preClose,
        refPrice,
        kind: String(row[6] || '').trim() || '息',
      };
    })
    .filter(Boolean);
};
