/**
 * 回填基準指數（TAIEX / 0050）的日線，可重複執行。
 *
 * 績效比較需要一條與個股同源的日線；benchmark 直接寫進 StockPrice，
 * 因此後續的 K 線快取、getLatest、getCloseOn 都不必另外處理。
 *
 * 用法：
 *   node prisma/scripts/backfillBenchmarks.js
 *   node prisma/scripts/backfillBenchmarks.js --from=2024-01-01 --to=2026-11-05
 *
 * 預設起點是最早一筆未刪除的成交，終點是今天。已 cache 的月份會跳過，
 * 只有當月會強制重抓（沿用 StockPriceService 的月粒度策略）。
 */

import 'dotenv/config';
import prisma from '../../config/database.js';
import StockPriceService from '../../services/StockPriceService.js';
import { BENCHMARKS } from '../../utils/benchmarks.js';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const earliestFillDate = async () => {
  const row = await prisma.positionAdjustment.findFirst({
    where: { deletedAt: null },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true },
  });
  return row ? row.timestamp.toISOString().slice(0, 10) : null;
};

const main = async () => {
  const from = arg('from', (await earliestFillDate()) || '2024-01-01');
  const to = arg('to', todayIso());

  console.log(`回填基準：${from} ~ ${to}`);

  for (const b of BENCHMARKS) {
    const rows = await StockPriceService.getKlineRange(b.symbol, from, to);
    const first = rows[0]?.date || '-';
    const last = rows[rows.length - 1]?.date || '-';
    console.log(`  ${b.symbol} ${b.name}：${rows.length} 筆（${first} ~ ${last}）`);
  }
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
