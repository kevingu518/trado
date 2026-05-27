import cron from 'node-cron';
import prisma from '../config/database.js';
import StockPriceService from '../services/StockPriceService.js';

/**
 * 撈出全資料庫所有 status='open' 的 trades 的 unique symbols
 * (跨用戶共用 cache，因為股價是公開資料)
 */
const collectOpenSymbols = async () => {
  const rows = await prisma.trade.findMany({
    where: { status: 'open' },
    select: { symbol: true },
    distinct: ['symbol'],
  });
  return rows.map((r) => r.symbol).filter(Boolean);
};

const runOnce = async () => {
  const startedAt = Date.now();
  console.log('[StockPriceJob] Starting daily price refresh...');
  try {
    const symbols = await collectOpenSymbols();
    if (symbols.length === 0) {
      console.log('[StockPriceJob] No open trades, skip.');
      return;
    }
    const { ok, fail } = await StockPriceService.refreshTodayPrices(symbols);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `[StockPriceJob] Done: ${ok} ok / ${fail} fail / ${symbols.length} total, ${elapsed}s`
    );
  } catch (err) {
    console.error('[StockPriceJob] Failed:', err.message);
  }
};

// 週一至週五 14:30（台股收盤後）— 跟 snapshot 同時段，但 snapshot 是 14:30，stock 設 14:35 錯開避免併發影響
cron.schedule(
  '35 14 * * 1-5',
  () => {
    runOnce().catch((err) => console.error('[StockPriceJob] runOnce error:', err));
  },
  { timezone: 'Asia/Taipei' }
);

console.log('[StockPriceJob] Scheduled: weekdays at 14:35 (Asia/Taipei)');

// 啟動後（dev/restart）也 trigger 一次，確保剛開機就有資料
// prod 環境如果不想啟動就跑，可以用 NODE_ENV gate
if (process.env.STOCK_PRICE_RUN_ON_BOOT === 'true') {
  console.log('[StockPriceJob] STOCK_PRICE_RUN_ON_BOOT=true → running once on boot');
  runOnce().catch((err) => console.error('[StockPriceJob] boot run error:', err));
}
