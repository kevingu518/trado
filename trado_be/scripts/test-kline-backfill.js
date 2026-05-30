/**
 * 驗證 lazy backfill 對「當月強制重抓」的修改是否生效。
 * 用法：node scripts/test-kline-backfill.js 8935
 */
import prisma from '../config/database.js';
import StockPriceService from '../services/StockPriceService.js';

async function main() {
  const symbol = process.argv[2] || '8935';
  console.log(`\n[Test] before — DB last 5 rows for ${symbol}:`);
  const before = await prisma.stockPrice.findMany({
    where: { symbol },
    orderBy: { date: 'desc' },
    take: 5,
  });
  before.forEach((r) => console.log(`  ${r.date.toISOString().slice(0, 10)}  close=${r.close}  ${r.source}`));

  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setMonth(start.getMonth() - 1);
  const startIso = start.toISOString().slice(0, 10);

  console.log(`\n[Test] triggering getKlineRange(${symbol}, ${startIso}, ${end})...`);
  const rows = await StockPriceService.getKlineRange(symbol, startIso, end);
  console.log(`[Test] returned ${rows.length} rows, last 3:`);
  rows.slice(-3).forEach((r) => console.log(`  ${r.date}  close=${r.close}`));

  console.log(`\n[Test] after — DB last 5 rows for ${symbol}:`);
  const after = await prisma.stockPrice.findMany({
    where: { symbol },
    orderBy: { date: 'desc' },
    take: 5,
  });
  after.forEach((r) => console.log(`  ${r.date.toISOString().slice(0, 10)}  close=${r.close}  ${r.source}`));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
