/**
 * 用「每日收盤市值」重算 BalanceSnapshot（可重複執行）
 *
 * 舊快照的 positionValue 是持倉成本（Trade.totalValue），不是市值，
 * 因此總資產曲線在持有期間幾乎是平的，最大回撤永遠算成 0。
 * 這支腳本依成交逐日重放持倉、以當日收盤價評價，整段覆寫指定區間的快照。
 *
 * 用法：
 *   node prisma/scripts/rebuildSnapshots.js --dry-run        只印不寫
 *   node prisma/scripts/rebuildSnapshots.js                  全部使用者，整段覆寫
 *   node prisma/scripts/rebuildSnapshots.js --user=<email>
 *   node prisma/scripts/rebuildSnapshots.js --from=2026-01-13 --to=2026-11-05
 *   node prisma/scripts/rebuildSnapshots.js --fetch          缺價時打 TWSE/TPEX 補齊（較慢）
 *
 * 預設不 --fetch：只用 DB 已有的 StockPrice。缺價的標的會退回最後一筆成交價，
 * 並在輸出中列出，讓你知道哪幾檔的估值是估算值。
 */

import 'dotenv/config';
import prisma from '../../config/database.js';
import EquityService from '../../services/EquityService.js';

const arg = (name, fallback = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const todayIso = () => new Date().toISOString().slice(0, 10);

const main = async () => {
  const dryRun = has('dry-run');
  const allowFetch = has('fetch');
  const email = arg('user');
  const from = arg('from');
  const to = arg('to', todayIso());

  const users = email
    ? await prisma.user.findMany({ where: { email }, select: { id: true, email: true } })
    : await prisma.user.findMany({ select: { id: true, email: true }, orderBy: { email: 'asc' } });

  if (users.length === 0) {
    console.log('找不到使用者');
    return;
  }

  console.log(`重算快照${dryRun ? '（dry-run，不寫入）' : ''}${allowFetch ? '（允許補抓價格）' : ''}`);

  for (const user of users) {
    const start = from || (await EquityService._earliestActivityIso(user.id));
    const series = await EquityService.buildSeries(user.id, { from: start, to, allowFetch });

    if (series.days.length === 0) {
      console.log(`\n${user.email}：區間內沒有資料，跳過`);
      continue;
    }

    const metrics = EquityService.computeMetrics(series.days);
    const first = series.days[0];
    const last = series.days[series.days.length - 1];

    console.log(`\n${user.email}`);
    console.log(`  區間：${first.date} ~ ${last.date}（${series.days.length} 個交易日）`);
    console.log(`  期初總資產：${first.totalAssets.toLocaleString()}`);
    console.log(`  期末總資產：${last.totalAssets.toLocaleString()}（現金 ${last.cash.toLocaleString()} + 市值 ${last.positionValue.toLocaleString()}）`);
    console.log(
      `  TWR：${(metrics.totalReturn * 100).toFixed(2)}% / 年化 ${(metrics.annualizedReturn * 100).toFixed(2)}% / MDD ${(metrics.maxDrawdown * 100).toFixed(2)}%`
    );
    if (series.missingPriceSymbols.length > 0) {
      console.log(`  ⚠ 無價格、以成交價估算的標的：${series.missingPriceSymbols.join(', ')}`);
    }

    if (dryRun) {
      const existing = await prisma.balanceSnapshot.count({
        where: {
          userId: user.id,
          date: { gte: new Date(first.date), lte: new Date(last.date) },
        },
      });
      console.log(`  將刪除 ${existing} 筆舊快照、寫入 ${series.days.length} 筆`);
      continue;
    }

    const result = await EquityService.rebuildSnapshots(user.id, {
      from: start,
      to,
      allowFetch,
      replaceRange: true,
    });
    console.log(`  ✓ 刪除 ${result.deleted} 筆、寫入 ${result.written} 筆`);
  }
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
