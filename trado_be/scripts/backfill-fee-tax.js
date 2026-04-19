/**
 * 一次性腳本：為既有 PositionAdjustment 回填手續費和證交稅
 *
 * 1. 為所有 sell 的 PositionAdjustment 回填 tax（預設 0.3% 稅率）
 * 2. 為所有 fee=0 的 PositionAdjustment 補算手續費
 * 3. 重新跑所有 Trade 的 calculateTradeMetrics()
 *
 * 使用方式：node scripts/backfill-fee-tax.js
 */
import prisma from '../config/database.js';
import TradeService from '../services/TradeService.js';
import { calculateFee, calculateTax } from '../utils/feeCalculator.js';

async function main() {
  // 取得所有用戶的 fee discount
  const users = await prisma.user.findMany({
    select: { id: true, brokerFeeDiscount: true },
  });
  const discountMap = new Map();
  for (const u of users) {
    discountMap.set(u.id, u.brokerFeeDiscount ? Number(u.brokerFeeDiscount) : 1.0);
  }

  // 取得所有未刪除的 PositionAdjustment（含 Trade 的 userId）
  const adjustments = await prisma.positionAdjustment.findMany({
    where: { deletedAt: null },
    include: {
      trade: { select: { userId: true } },
    },
  });

  console.log(`Found ${adjustments.length} adjustments to process.`);

  let feeUpdated = 0;
  let taxUpdated = 0;

  for (const adj of adjustments) {
    const discount = discountMap.get(adj.trade.userId) || 1.0;
    const updateData = {};

    // 回填手續費（fee 為 0 的）
    if (adj.fee === 0) {
      updateData.fee = calculateFee(adj.shares, adj.price, discount);
      feeUpdated++;
    }

    // 回填證交稅（sell 且 tax 為 0 的）
    if (adj.action === 'sell' && adj.tax === 0) {
      updateData.tax = calculateTax(adj.shares, adj.price, adj.isDayTrade);
      taxUpdated++;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.positionAdjustment.update({
        where: { id: adj.id },
        data: updateData,
      });
    }
  }

  console.log(`Fee updated: ${feeUpdated}, Tax updated: ${taxUpdated}`);

  // 重新計算所有 Trade 的 metrics
  const trades = await prisma.trade.findMany({
    select: { id: true, symbol: true },
  });

  console.log(`\nRecalculating metrics for ${trades.length} trades...`);

  let success = 0;
  let failed = 0;

  for (const trade of trades) {
    try {
      const result = await TradeService.calculateTradeMetrics(trade.id);
      console.log(`[OK] ${trade.symbol} (${trade.id}) — fee: ${result.totalFee}, tax: ${result.totalTax}, net: ${result.netProfitLoss}`);
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
