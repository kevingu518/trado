import prisma from '../config/database.js';
import { AppError } from '../errors/index.js';
import { FEE_RATE, MIN_FEE, TAX_RATE, DAY_TRADE_TAX_RATE } from '../utils/feeCalculator.js';
import EquityService from './EquityService.js';

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
   *
   * 持倉以「該日收盤價 × 股數」評價（mark-to-market）。舊版用 Trade.totalValue，
   * 那其實是持倉成本，行情漲跌完全反映不到總資產上，導致總資產曲線是階梯狀、
   * 回撤永遠為 0。評價邏輯集中在 EquityService，避免各處算法分歧。
   */
  async createOrUpdateSnapshot(userId, date) {
    const isoDate = new Date(date).toISOString().slice(0, 10);
    const snapshotDate = new Date(`${isoDate}T00:00:00.000Z`);

    const valuation = await EquityService.getValuation(userId, isoDate);

    await prisma.balanceSnapshot.upsert({
      where: {
        userId_date: { userId, date: snapshotDate },
      },
      update: {
        cashBalance: valuation.cashBalance,
        positionValue: valuation.marketValue,
        totalAssets: valuation.totalAssets,
      },
      create: {
        userId,
        date: snapshotDate,
        cashBalance: valuation.cashBalance,
        positionValue: valuation.marketValue,
        totalAssets: valuation.totalAssets,
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
    // 公式集中在 EquityService.computeCash，避免現金計算出現兩份會各自漂移的實作
    return EquityService.computeCash(userId);
  }

  /**
   * 計算不含 cashAdjustment 的原始現金值（內部用，設定現金時反算 adjustment）
   */
  async _computeRawCashBalance(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cashAdjustment: true },
    });
    const total = await EquityService.computeCash(userId);
    return total - Math.round(user?.cashAdjustment || 0);
  }
}

export default new AccountService();
