/**
 * 一次性腳本：重新計算所有 trade 的 metrics
 * 修正 holdingDuration 負數問題，並補上 grossProfitLoss / netProfitLoss
 *
 * 使用方式：node scripts/recalculate-trade-metrics.js
 */
import prisma from '../config/database.js';
import TradeService from '../services/TradeService.js';

async function main() {
  const trades = await prisma.trade.findMany({
    select: { id: true, symbol: true, status: true },
  });

  console.log(`Found ${trades.length} trades to recalculate.`);

  let success = 0;
  let failed = 0;

  for (const trade of trades) {
    try {
      const result = await TradeService.calculateTradeMetrics(trade.id);
      console.log(`[OK] ${trade.symbol} (${trade.id}) — netProfitLoss: ${result.netProfitLoss}, holdingDuration: ${result.holdingDuration}`);
      success++;
    } catch (err) {
      console.error(`[FAIL] ${trade.symbol} (${trade.id}) — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
