/**
 * 回填除權息事件（上市 TWSE），可重複執行。
 *
 * 除權息還原需要「除權息前收盤價」與「除權息參考價」，交易所的
 * TWT49U 一次可以回一整個日期區間，所以直接從最早的價格資料回填到今天。
 *
 * 上櫃（TPEX）不在這張表：櫃買中心的 OpenAPI 只給「當日」除權息，
 * 歷史事件無法回補，只能靠每日排程慢慢累積。這支腳本只處理上市。
 *
 * 用法：
 *   node prisma/scripts/backfillCorporateActions.js
 *   node prisma/scripts/backfillCorporateActions.js --from=2024-01-01 --to=2026-11-05
 *   node prisma/scripts/backfillCorporateActions.js --dry-run
 */

import 'dotenv/config';
import prisma from '../../config/database.js';
import CorporateActionService from '../../services/CorporateActionService.js';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const todayIso = () => new Date().toISOString().slice(0, 10);

const earliestPriceDate = async () => {
  const row = await prisma.stockPrice.findFirst({
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  return row ? row.date.toISOString().slice(0, 10) : null;
};

// TWT49U 一次回整段沒問題，但整年一次抓回來會有點大，切成兩個月一段比較穩
const chunkMonths = (fromIso, toIso, months = 2) => {
  const out = [];
  let cur = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${toIso}T00:00:00Z`);
  while (cur <= end) {
    const next = new Date(cur);
    next.setUTCMonth(next.getUTCMonth() + months);
    const segEnd = new Date(Math.min(next.getTime() - 86400000, end.getTime()));
    out.push([cur.toISOString().slice(0, 10), segEnd.toISOString().slice(0, 10)]);
    cur = next;
  }
  return out;
};

const main = async () => {
  const from = arg('from', (await earliestPriceDate()) || '2024-01-01');
  const to = arg('to', todayIso());
  const dryRun = hasFlag('dry-run');

  const segments = chunkMonths(from, to);
  console.log(`回填除權息（上市）：${from} ~ ${to}（${segments.length} 段）${dryRun ? ' [dry-run]' : ''}`);

  let totalFetched = 0;
  let totalWritten = 0;

  for (const [segFrom, segTo] of segments) {
    if (dryRun) {
      // dry-run 只驗證抓得到，不寫 DB
      const { fetchTwseExRightRange } = await import('../../services/stockSources/twseSource.js');
      const events = await fetchTwseExRightRange(segFrom, segTo);
      console.log(`  ${segFrom} ~ ${segTo}：${events.length} 筆（未寫入）`);
      totalFetched += events.length;
      continue;
    }
    const res = await CorporateActionService.syncTwseRange(segFrom, segTo);
    console.log(`  ${segFrom} ~ ${segTo}：抓 ${res.fetched} 筆，寫入 ${res.written} 筆`);
    totalFetched += res.fetched;
    totalWritten += res.written;
  }

  const stored = await prisma.corporateAction.count();
  console.log(
    dryRun
      ? `合計抓到 ${totalFetched} 筆（dry-run 未寫入）；資料庫現有 ${stored} 筆`
      : `合計抓 ${totalFetched} 筆、寫入 ${totalWritten} 筆；資料庫現有 ${stored} 筆`
  );
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
