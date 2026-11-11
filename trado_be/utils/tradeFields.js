/**
 * 交易紀錄匯入／匯出的系統欄位定義 —— 單一真實來源。
 *
 * 匯入的「欄位對應」UI 與匯出 CSV 都由這份清單產生，
 * 因此匯出的檔案必定能再匯入（round-trip，TD-112 驗收標準）。
 *
 * 兩點刻意的設計：
 * 1. `persist: false` 的欄位只參與對應與預覽，不寫入資料庫。
 *    Trade 沒有股票名稱欄位，名稱純粹讓使用者在預覽時核對對應是否正確。
 * 2. 所有日期一律以 UTC 建構（見 parseDateTime）。若用 `new Date('2026-09-29 09:03:00')`
 *    會以「伺服器本地時區」解讀，同一份檔案在不同機器會寫入不同時間點，
 *    指紋跟著改變，去重與 round-trip 都會失效。
 */

import crypto from 'crypto';

export const SYSTEM_FIELDS = Object.freeze([
  {
    key: 'timestamp',
    label: '日期',
    type: 'datetime',
    required: true,
    persist: true,
    description: '成交日期與時間',
    aliases: [
      '日期', '成交日期', '交易日期', '成交日', '交易時間', '成交時間',
      '成交日期時間', 'date', 'trade date', 'datetime', 'time', 'transaction date',
    ],
  },
  {
    key: 'symbol',
    label: '代號',
    type: 'string',
    required: true,
    persist: true,
    description: '股票代號',
    aliases: [
      '代號', '股票代號', '商品代號', '證券代號', '股票代碼', '商品代碼', '代碼',
      'symbol', 'ticker', 'stock', 'stock id', 'code', 'security code',
    ],
  },
  {
    key: 'name',
    label: '名稱',
    type: 'string',
    required: false,
    persist: false,
    description: '股票名稱（僅供預覽核對，不寫入資料庫）',
    aliases: ['名稱', '股票名稱', '商品名稱', '證券名稱', '股名', 'name', 'stock name'],
  },
  {
    key: 'action',
    label: '動作',
    type: 'action',
    required: true,
    persist: true,
    description: '買 / 賣',
    aliases: [
      '動作', '買賣別', '買賣', '交易別', '買賣類別', '交易類別', '買賣註記',
      'action', 'side', 'buy/sell', 'type', 'bs',
    ],
  },
  {
    key: 'shares',
    label: '股數',
    type: 'number',
    required: true,
    persist: true,
    description: '成交股數（整數）',
    aliases: [
      '股數', '成交股數', '數量', '成交數量', 'shares', 'share', 'qty', 'quantity', 'volume',
    ],
  },
  {
    key: 'price',
    label: '價格',
    type: 'number',
    required: true,
    persist: true,
    description: '每股成交價',
    aliases: [
      '價格', '成交價', '成交單價', '單價', '均價', '每股價格', '每股單價',
      'price', 'unit price', 'avg price', 'deal price',
    ],
  },
  {
    key: 'fee',
    label: '手續費',
    type: 'number',
    required: false,
    persist: true,
    description: '留空時依使用者券商折扣自動計算',
    aliases: ['手續費', '手續費合計', '費用', '交易費用', 'fee', 'commission', 'charge'],
  },
  {
    key: 'tax',
    label: '交易稅',
    type: 'number',
    required: false,
    persist: true,
    description: '留空時於賣出依證交稅率自動計算',
    aliases: ['交易稅', '證交稅', '證券交易稅', '稅', '稅金', 'tax', 'transaction tax'],
  },
  {
    key: 'note',
    label: '備註',
    type: 'string',
    required: false,
    persist: true,
    description: '備註',
    aliases: ['備註', '摘要', '說明', '註記', 'note', 'memo', 'remark', 'comment', 'description'],
  },
]);

export const REQUIRED_FIELD_KEYS = Object.freeze(
  SYSTEM_FIELDS.filter((f) => f.required).map((f) => f.key)
);

/** 匯出表頭＝系統欄位標籤（順序一致），確保匯出檔可直接再匯入 */
export const EXPORT_COLUMNS = Object.freeze(SYSTEM_FIELDS.map((f) => f.label));

export const FIELD_BY_KEY = Object.freeze(
  Object.fromEntries(SYSTEM_FIELDS.map((f) => [f.key, f]))
);

export const FIELD_BY_LABEL = Object.freeze(
  Object.fromEntries(SYSTEM_FIELDS.map((f) => [f.label, f]))
);

// ---------------------------------------------------------------------------
// 值正規化
// ---------------------------------------------------------------------------

/** 全形英數與標點轉半形（券商檔案常見） */
export function normalizeWidth(input) {
  return String(input ?? '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

const ACTION_LOOKUP = new Map();
const registerActions = (canonical, words) => {
  for (const w of words) ACTION_LOOKUP.set(w, canonical);
};
registerActions('buy', ['buy', 'b', '買', '買進', '買入', '現買', '資買', '融資買進', '融資買', '普通買進']);
registerActions('sell', ['sell', 's', '賣', '賣出', '現賣', '券賣', '融券賣出', '融券賣', '普通賣出']);

/**
 * 動作正規化 → 'buy' | 'sell' | null
 * 一律收斂成 buy/sell 才計算指紋，因此「買」與「buy」在去重時視為同一筆。
 */
export function normalizeAction(value) {
  if (value == null) return null;
  const key = normalizeWidth(value).trim().toLowerCase().replace(/\s+/g, '');
  if (!key) return null;

  const exact = ACTION_LOOKUP.get(key);
  if (exact) return exact;

  // 複合詞 fallback：融資買進、現股賣出…等，取唯一出現的中文字判斷
  const hasBuy = key.includes('買');
  const hasSell = key.includes('賣');
  if (hasBuy && !hasSell) return 'buy';
  if (hasSell && !hasBuy) return 'sell';
  return null;
}

/**
 * 數字正規化 → number | null
 * 容忍千分位、貨幣符號、全形字、括號負數。
 */
export function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let s = normalizeWidth(value).trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  s = s.replace(/[,\s$＄元股]/g, '');
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = true;
    s = s.slice(1);
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Excel 日期序號 → Date（SheetJS 在部分格式下會回傳序號而非 Date） */
function excelSerialToDate(serial) {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 以 UTC 建構日期，並擋掉 2/31 這類會自動進位的非法日期 */
function buildUTC(year, month, day, hour = 0, minute = 0, second = 0) {
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute);
  const s = Number(second);

  if (!Number.isInteger(y) || y < 1900 || y > 2999) return null;
  if (!Number.isInteger(mo) || mo < 1 || mo > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  if (!Number.isInteger(mi) || mi < 0 || mi > 59) return null;
  if (!Number.isInteger(s) || s < 0 || s > 59) return null;

  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  // 溢位檢查：2/31 會被 Date 滾成 3/3
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

const SEPARATED_DATE_RE = /^(\d{2,4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;
const COMPACT_DATE_RE = /^(\d{3,4})(\d{2})(\d{2})$/;

/**
 * 日期正規化 → Date | null（一律 UTC）
 * 支援 2026-09-29 / 2026/9/29 / 2026.09.29 / 20260929 / 民國年 113/09/29，
 * 以及帶時區的完整 ISO 字串。
 */
export function parseDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return excelSerialToDate(value);

  const s = normalizeWidth(value).trim();
  if (!s) return null;

  // 已帶時區的 ISO 字串：時間點明確，直接採用
  if (/\dT\d.*(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const separated = s.match(SEPARATED_DATE_RE);
  if (separated) {
    let [, y, mo, d, h, mi, sec] = separated;
    let year = Number(y);
    if (year < 1911) year += 1911; // 民國年：113 → 2024
    return buildUTC(year, mo, d, h ?? 0, mi ?? 0, sec ?? 0);
  }

  const compact = s.match(COMPACT_DATE_RE);
  if (compact) {
    let year = Number(compact[1]);
    if (year < 1911) year += 1911;
    return buildUTC(year, compact[2], compact[3]);
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** 匯出與指紋共用的日期字串（UTC，秒級），保證 round-trip 後完全相同 */
export function formatDateTimeUTC(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

/** 字串欄位正規化 */
export function parseText(value) {
  if (value == null) return null;
  const s = normalizeWidth(value).trim();
  return s === '' ? null : s;
}

/** 股票代號正規化：去空白、轉大寫 */
export function normalizeSymbol(value) {
  const s = parseText(value);
  return s ? s.replace(/\s+/g, '').toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// 指紋（去重）
// ---------------------------------------------------------------------------

/**
 * 去重指紋 = SHA-256(日期 + 代號 + 動作 + 股數 + 價格)
 *
 * 刻意使用「即將寫入資料庫的正規化值」計算，而非原始字串：
 * price 先四捨五入到小數 2 位（Decimal(18,2)），shares 取整（Int）。
 * 否則匯出的 100.13 再匯入時指紋會與原始的 100.125 不同，去重就失效。
 */
export function buildFingerprint({ timestamp, symbol, action, shares, price }) {
  const payload = [
    formatDateTimeUTC(timestamp),
    normalizeSymbol(symbol),
    action,
    String(Math.round(Number(shares))),
    Number(price).toFixed(2),
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ---------------------------------------------------------------------------
// 匯出列
// ---------------------------------------------------------------------------

/**
 * 把一筆 PositionAdjustment（＋所屬 Trade）轉成匯出列。
 * 欄位順序與 EXPORT_COLUMNS 一致。
 */
export function formatExportRow(adjustment, trade) {
  const action = adjustment.action === 'buy' ? '買' : '賣';
  return [
    formatDateTimeUTC(adjustment.timestamp),
    trade?.symbol ?? '',
    '', // 名稱：本站未儲存股票名稱，固定留空
    action,
    String(adjustment.shares),
    Number(adjustment.price).toFixed(2),
    adjustment.fee != null ? String(adjustment.fee) : '',
    adjustment.tax != null ? String(adjustment.tax) : '',
    adjustment.note ?? '',
  ];
}

// ---------------------------------------------------------------------------
// 表頭自動對應
// ---------------------------------------------------------------------------

const headerKey = (s) =>
  normalizeWidth(s ?? '')
    .toLowerCase()
    .replace(/[\s_\-()[\]{}【】（）]/g, '');

/**
 * 依表頭名稱猜測欄位對應 → { [fieldKey]: headerName }
 *
 * 回傳的是「表頭字串」而不是索引：同一來源的檔案欄位順序可能不同，
 * 存名稱才能在下次匯入時正確套用。
 */
export function guessMapping(headers) {
  const prepared = headers.map((h) => ({ header: h, key: headerKey(h) }));
  const used = new Set();
  const mapping = {};

  for (const field of SYSTEM_FIELDS) {
    const candidates = [field.label, field.key, ...field.aliases]
      .map(headerKey)
      .filter((c) => c.length > 0);

    // 先精確比對，避免「成交價」被「成交價量」之類的模糊規則搶走
    let hit = prepared.find((p) => !used.has(p.header) && candidates.includes(p.key));

    if (!hit) {
      hit = prepared.find(
        (p) =>
          !used.has(p.header) &&
          p.key.length > 0 &&
          candidates.some((c) => c.length >= 2 && (p.key.includes(c) || c.includes(p.key)))
      );
    }

    if (hit) {
      mapping[field.key] = hit.header;
      used.add(hit.header);
    }
  }

  return mapping;
}
