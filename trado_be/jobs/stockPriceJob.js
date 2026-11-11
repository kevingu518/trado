import cron from 'node-cron';
import prisma from '../config/database.js';
import StockPriceService from '../services/StockPriceService.js';
import CorporateActionService from '../services/CorporateActionService.js';
import { BENCHMARK_SYMBOLS } from '../utils/benchmarks.js';

/**
 * 撈出全資料庫所有 status='open' 的 trades 的 unique symbols
 * (跨用戶共用 cache，因為股價是公開資料)
 *
 * 另外固定補上基準（TAIEX、0050）：績效頁要拿它們算 alpha/beta 與超額報酬，
 * 只抓持倉標的的話，基準線會停在最後一次手動補價那天，之後全部過期。
 */
const collectOpenSymbols = async () => {
  const rows = await prisma.trade.findMany({
    where: { status: 'open' },
    select: { symbol: true },
    distinct: ['symbol'],
  });
  const symbols = rows.map((r) => r.symbol).filter(Boolean);
  return [...new Set([...symbols, ...BENCHMARK_SYMBOLS])];
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

    // 除權息事件：上市補最近 7 天（參考價偶有更正），上櫃只抓當日
    try {
      const ca = await CorporateActionService.syncDaily();
      const twse = ca.twse ? `${ca.twse.written} 筆` : '失敗';
      const tpex = ca.tpex ? `${ca.tpex.written} 筆` : '失敗';
      console.log(`[StockPriceJob] Corporate actions: TWSE ${twse} / TPEX ${tpex}`);
      if (ca.errors.length > 0) {
        console.warn(`[StockPriceJob] Corporate actions warnings: ${ca.errors.join('; ')}`);
      }
    } catch (err) {
      // 除權息同步失敗不該讓股價更新被視為失敗
      console.error('[StockPriceJob] Corporate action sync failed:', err.message);
    }
  } catch (err) {
    console.error('[StockPriceJob] Failed:', err.message);
  }
};

// 週一至週五 16:00（台股收盤後）。TPEX 上櫃資料通常比 TWSE 晚 30~60 分鐘 publish，
// 14:30 收盤後跑太早會抓不到當日上櫃資料（曾經漏抓 8935 5/29）。設 16:00 保守等資料就緒。
cron.schedule(
  '0 16 * * 1-5',
  () => {
    runOnce().catch((err) => console.error('[StockPriceJob] runOnce error:', err));
  },
  { timezone: 'Asia/Taipei' }
);

console.log('[StockPriceJob] Scheduled: weekdays at 16:00 (Asia/Taipei)');

// 啟動後（dev/restart）也 trigger 一次，確保剛開機就有資料
// prod 環境如果不想啟動就跑，可以用 NODE_ENV gate
if (process.env.STOCK_PRICE_RUN_ON_BOOT === 'true') {
  console.log('[StockPriceJob] STOCK_PRICE_RUN_ON_BOOT=true → running once on boot');
  runOnce().catch((err) => console.error('[StockPriceJob] boot run error:', err));
}
