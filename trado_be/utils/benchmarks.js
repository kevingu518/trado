/**
 * 基準（benchmark）定義
 *
 * 兩個都存，讓績效頁可以切換：
 *  - TAIEX：加權指數，台股最常用的相對基準（價格指數，不含息）
 *  - 0050 ：元大台灣50，實際可投資的 ETF（本站目前只有價格報酬，除息還原見 A6）
 *
 * symbol 直接沿用 StockPrice.symbol，因此 benchmark 與個股共用同一套
 * 價格快取與 lazy backfill，不需要另一張表。
 */
export const BENCHMARKS = [
  { symbol: 'TAIEX', name: '台股加權指數', kind: 'index' },
  { symbol: '0050', name: '元大台灣50', kind: 'etf' },
];

export const DEFAULT_BENCHMARK = 'TAIEX';

/** 每日排程要固定補價的 symbol（不含使用者持倉） */
export const BENCHMARK_SYMBOLS = BENCHMARKS.map((b) => b.symbol);

/** 走 FMTQIK（大盤指數）而非 STOCK_DAY 的 symbol */
export const INDEX_SYMBOLS = new Set(
  BENCHMARKS.filter((b) => b.kind === 'index').map((b) => b.symbol)
);

export const isBenchmark = (symbol) => BENCHMARKS.some((b) => b.symbol === symbol);

export const getBenchmark = (symbol) =>
  BENCHMARKS.find((b) => b.symbol === symbol) || null;
