/**
 * 回填 PositionAdjustment.fingerprint（一次性，可重複執行）
 *
 * 指紋欄位是隨匯入功能一起加上的，在這之前建立的部位調整（手動開單）
 * 全都是 NULL。去重是拿指紋比對的，NULL 對不到任何東西，
 * 因此「匯出 → 再匯入」會把既有資料整批當成新資料重複寫入（TD-112 驗收：匯出#2）。
 *
 * 用法：
 *   node prisma/scripts/backfillFingerprints.js          # 實際寫入
 *   node prisma/scripts/backfillFingerprints.js --dry-run # 只報告
 *
 * 刻意用 services 同一支 buildFingerprint，而不是在 SQL 裡重寫一份：
 * 兩份實作只要有一點格式差異（大小寫、四捨五入、日期格式），
 * 回填出來的指紋就會和匯入時算的對不上，而且錯得完全沒有聲音。
 * 只補 NULL，既有指紋不會被覆蓋。
 */

import 'dotenv/config';
import prisma from '../../config/database.js';
import { buildFingerprint } from '../../utils/tradeFields.js';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

const main = async () => {
  const targets = await prisma.positionAdjustment.findMany({
    where: { fingerprint: null },
    select: {
      id: true,
      action: true,
      shares: true,
      price: true,
      timestamp: true,
      trade: { select: { symbol: true } },
    },
    orderBy: { id: 'asc' },
  });

  if (targets.length === 0) {
    console.log('沒有需要回填的資料。');
    return;
  }

  const updates = targets.map((row) => ({
    id: row.id,
    fingerprint: buildFingerprint({
      timestamp: row.timestamp,
      symbol: row.trade.symbol,
      action: row.action,
      shares: row.shares,
      price: row.price,
    }),
  }));

  // 指紋重複是正常的（同日同價同量的兩筆成交），只回報數量供核對
  const distinct = new Set(updates.map((u) => u.fingerprint)).size;
  console.log(`待回填 ${updates.length} 筆（其中 ${distinct} 個相異指紋）`);

  if (DRY_RUN) {
    console.log('--dry-run：未寫入任何資料。');
    return;
  }

  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.positionAdjustment.update({
          where: { id: u.id },
          data: { fingerprint: u.fingerprint },
        })
      )
    );
    done += batch.length;
  }

  console.log(`已回填 ${done} 筆。`);
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
