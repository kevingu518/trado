import prisma from '../config/database.js';
import { AppError } from '../errors/index.js';
import { FEE_RATE, MIN_FEE, TAX_RATE, DAY_TRADE_TAX_RATE } from '../utils/feeCalculator.js';

class AccountService {
  /**
   * 取得用戶當前餘額
   */
  async getBalance(userId) {
    // 動態計算含交易成本的現金餘額
    const currentBalance = await this._computeCashBalance(userId);

    // 計算總入金和總出金
    const aggregations = await prisma.accountTransaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });

    let totalDeposit = 0;
    let totalWithdraw = 0;
    for (const agg of aggregations) {
      if (agg.type === 'deposit') totalDeposit = agg._sum.amount || 0;
      if (agg.type === 'withdraw') totalWithdraw = agg._sum.amount || 0;
    }

    return {
      balance: currentBalance,
      total_deposit: totalDeposit,
      total_withdraw: totalWithdraw,
      available_balance: currentBalance,
    };
  }

  /**
   * 入金
   */
  async deposit(userId, { amount, date, method, notes }) {
    if (!amount || amount <= 0) {
      throw new AppError('Amount must be greater than 0', 400);
    }

    const currentBalance = await this._computeCashBalance(userId);
    const newBalance = currentBalance + amount;

    const transaction = await prisma.accountTransaction.create({
      data: {
        userId,
        type: 'deposit',
        amount,
        balance: newBalance,
        method: method || null,
        notes: notes || null,
        date: new Date(date),
      },
    });

    // 觸發當天快照更新
    await this.createOrUpdateSnapshot(userId, new Date(date));

    return this.getBalance(userId);
  }

  /**
   * 出金
   */
  async withdraw(userId, { amount, date, method, notes }) {
    if (!amount || amount <= 0) {
      throw new AppError('Amount must be greater than 0', 400);
    }

    const currentBalance = await this._computeCashBalance(userId);
    if (currentBalance < amount) {
      throw new AppError('Insufficient balance', 400);
    }

    const newBalance = currentBalance - amount;

    const transaction = await prisma.accountTransaction.create({
      data: {
        userId,
        type: 'withdraw',
        amount,
        balance: newBalance,
        method: method || null,
        notes: notes || null,
        date: new Date(date),
      },
    });

    // 觸發當天快照更新
    await this.createOrUpdateSnapshot(userId, new Date(date));

    return this.getBalance(userId);
  }

  /**
   * 取得資金變動歷史
   */
  async getHistory(userId, { startDate, endDate, page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const [transactions, total] = await Promise.all([
      prisma.accountTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.accountTransaction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balance: t.balance,
        date: t.date,
        method: t.method,
        notes: t.notes,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };
  }

  /**
   * 建立或更新某天的資產快照
   */
  async createOrUpdateSnapshot(userId, date) {
    const snapshotDate = new Date(date.toISOString().slice(0, 10));

    // 取得動態計算的現金餘額（含交易成本）
    const cashBalance = await this._computeCashBalance(userId);

    // 計算持倉市值（open trades 的 totalValue 之和）
    const openTrades = await prisma.trade.findMany({
      where: { userId, status: 'open' },
      select: { totalValue: true },
    });

    const positionValue = openTrades.reduce((sum, t) => {
      return sum + (t.totalValue ? Number(t.totalValue) : 0);
    }, 0);

    const totalAssets = cashBalance + Math.round(positionValue);

    await prisma.balanceSnapshot.upsert({
      where: {
        userId_date: { userId, date: snapshotDate },
      },
      update: {
        cashBalance,
        positionValue: Math.round(positionValue),
        totalAssets,
      },
      create: {
        userId,
        date: snapshotDate,
        cashBalance,
        positionValue: Math.round(positionValue),
        totalAssets,
      },
    });
  }

  /**
   * 為所有活躍用戶建立每日快照（定時任務用）
   */
  async createDailySnapshotsForAllUsers() {
    const today = new Date();

    // 找所有有出入金記錄或有交易的用戶
    const userIds = await prisma.$queryRaw`
      SELECT DISTINCT "userId" FROM (
        SELECT "userId" FROM "AccountTransaction"
        UNION
        SELECT "userId" FROM "Trade"
      ) AS active_users
    `;

    for (const { userId } of userIds) {
      try {
        await this.createOrUpdateSnapshot(userId, today);
      } catch (err) {
        console.error(`Failed to create snapshot for user ${userId}:`, err.message);
      }
    }

    console.log(`Daily snapshots created for ${userIds.length} users`);
  }

  /**
   * 取得用戶交易費率設定
   */
  async getTradeSettings(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { brokerFeeDiscount: true },
    });

    return {
      buy_fee_rate: FEE_RATE,
      sell_fee_rate: FEE_RATE,
      sell_tax_rate: TAX_RATE,
      day_trade_tax_rate: DAY_TRADE_TAX_RATE,
      min_fee: MIN_FEE,
      broker_fee_discount: user?.brokerFeeDiscount ? Number(user.brokerFeeDiscount) : null,
    };
  }

  /**
   * 更新用戶交易費率設定
   */
  async updateTradeSettings(userId, { broker_fee_discount }) {
    if (broker_fee_discount != null) {
      const discount = Number(broker_fee_discount);
      if (isNaN(discount) || discount < 0.01 || discount > 1.0) {
        throw new AppError('broker_fee_discount must be between 0.01 and 1.0', 400);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        brokerFeeDiscount: broker_fee_discount != null ? broker_fee_discount : null,
      },
    });

    return this.getTradeSettings(userId);
  }

  /**
   * 設定現金餘額 — 用戶輸入實際帳上現金，系統反算 cashAdjustment
   */
  async setCashBalance(userId, targetBalance) {
    if (targetBalance == null || isNaN(targetBalance)) {
      throw new AppError('balance is required and must be a number', 400);
    }

    const target = Math.round(Number(targetBalance));

    // 算出不含 cashAdjustment 的原始現金
    const rawCash = await this._computeRawCashBalance(userId);

    // 反算需要的 adjustment
    const cashAdjustment = target - rawCash;

    await prisma.user.update({
      where: { id: userId },
      data: { cashAdjustment },
    });

    // 建立紀錄（type: set_balance，不參與動態計算，純 log）
    await prisma.accountTransaction.create({
      data: {
        userId,
        type: 'set_balance',
        amount: target,
        balance: target,
        notes: '設定現金餘額',
        date: new Date(),
      },
    });

    // 立即做快照
    await this.createOrUpdateSnapshot(userId, new Date());

    return this.getBalance(userId);
  }

  /**
   * 動態計算現金餘額
   * cashBalance = cashAdjustment + 入金 - 出金 - 買入成本(含手續費) + 賣出收入(扣手續費和稅)
   */
  async _computeCashBalance(userId) {
    // 0. 取得用戶的 cashAdjustment（設定現金餘額時由系統計算的補正值）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cashAdjustment: true },
    });
    const cashAdjustment = user?.cashAdjustment || 0;

    // 1. 出入金加總
    const txnAgg = await prisma.accountTransaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });
    const deposits = txnAgg.find(a => a.type === 'deposit')?._sum.amount || 0;
    const withdrawals = txnAgg.find(a => a.type === 'withdraw')?._sum.amount || 0;

    // 2. 交易成本加總（Prisma groupBy 不支援 shares*price，用 raw SQL）
    const tradeCosts = await prisma.$queryRaw`
      SELECT
        pa.action,
        COALESCE(SUM(pa.shares * pa.price), 0) AS "grossAmount",
        COALESCE(SUM(pa.fee), 0) AS "totalFee",
        COALESCE(SUM(pa.tax), 0) AS "totalTax"
      FROM "PositionAdjustment" pa
      JOIN "Trade" t ON pa."tradeId" = t.id
      WHERE t."userId" = ${userId} AND pa."deletedAt" IS NULL
      GROUP BY pa.action
    `;

    let buyCost = 0;
    let sellProceeds = 0;
    for (const row of tradeCosts) {
      const gross = Number(row.grossAmount);
      const fee = Number(row.totalFee);
      const tax = Number(row.totalTax);
      if (row.action === 'buy') buyCost = gross + fee;
      if (row.action === 'sell') sellProceeds = gross - fee - tax;
    }

    return Math.round(cashAdjustment + deposits - withdrawals - buyCost + sellProceeds);
  }

  /**
   * 計算不含 cashAdjustment 的原始現金值（內部用，設定現金時反算 adjustment）
   */
  async _computeRawCashBalance(userId) {
    const txnAgg = await prisma.accountTransaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });
    const deposits = txnAgg.find(a => a.type === 'deposit')?._sum.amount || 0;
    const withdrawals = txnAgg.find(a => a.type === 'withdraw')?._sum.amount || 0;

    const tradeCosts = await prisma.$queryRaw`
      SELECT
        pa.action,
        COALESCE(SUM(pa.shares * pa.price), 0) AS "grossAmount",
        COALESCE(SUM(pa.fee), 0) AS "totalFee",
        COALESCE(SUM(pa.tax), 0) AS "totalTax"
      FROM "PositionAdjustment" pa
      JOIN "Trade" t ON pa."tradeId" = t.id
      WHERE t."userId" = ${userId} AND pa."deletedAt" IS NULL
      GROUP BY pa.action
    `;

    let buyCost = 0;
    let sellProceeds = 0;
    for (const row of tradeCosts) {
      const gross = Number(row.grossAmount);
      const fee = Number(row.totalFee);
      const tax = Number(row.totalTax);
      if (row.action === 'buy') buyCost = gross + fee;
      if (row.action === 'sell') sellProceeds = gross - fee - tax;
    }

    return Math.round(deposits - withdrawals - buyCost + sellProceeds);
  }
}

export default new AccountService();
