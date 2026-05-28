/**
 * 一次性腳本：重算所有策略的當前績效快照
 *
 * 背景：在加入「交易變動自動刷新策略快照」前建立的快照可能是舊的（甚至 totalTrades=0），
 * 此腳本會把每個策略的 isCurrentSnapshot 快照重新算過。
 *
 * 使用方式：node scripts/refresh-strategy-snapshots.js
 */
import prisma from '../config/database.js';
import strategyService from '../services/StrategyService.js';

async function main() {
  const strategies = await prisma.strategy.findMany({
    select: { id: true, name: true },
  });

  console.log(`Found ${strategies.length} strategies to refresh.`);

  let success = 0;
  let failed = 0;

  for (const s of strategies) {
    try {
      const snap = await strategyService.calculateAndCreateSnapshot(s.id);
      console.log(
        `[OK] ${s.name} (${s.id}) — totalTrades: ${snap.totalTrades}, totalProfitLoss: ${snap.totalProfitLoss}, winRate: ${snap.winRate}`
      );
      success++;
    } catch (err) {
      console.error(`[FAIL] ${s.name} (${s.id}) — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. success=${success}, failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
