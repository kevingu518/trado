import prisma from '../config/database.js';
import { NotFoundError, AppError } from '../errors/index.js';

class StrategyService {
  async getAllStrategies(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // 驗證參數
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); // 最多 100 筆
    const skip = (pageNum - 1) * limitNum;

    // 建立 where 條件
    const where = {
      userId,
      ...(category && { category }),
      ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
    };

    // 建立排序條件
    const orderBy = {};
    const validSortFields = ['createdAt', 'updatedAt', 'name', 'category'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
    orderBy[sortField] = order;

    // 並行查詢：取得資料和總數
    const [strategies, total] = await Promise.all([
      prisma.strategy.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.strategy.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      strategies,
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

  async getStrategyById(id, userId) {
    const strategy = await prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundError('Strategy not found');
    }

    // 檢查是否為該用戶的策略
    if (strategy.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return strategy;
  }

  async createStrategy(data, userId) {
    // 驗證必填欄位
    if (!data.name) {
      throw new AppError('Name is required', 400);
    }

    // 驗證 category 必須是有效的值
    const validCategories = ['TREND_FOLLOWING', 'CONTRARIAN', 'DAY_TRADING', 'DIVIDEND_INVESTING'];
    if (data.category && !validCategories.includes(data.category)) {
      throw new AppError(
        `Category must be one of: ${validCategories.join(', ')}`,
        400
      );
    }

    return await prisma.strategy.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async updateStrategy(id, data, userId) {
    const strategy = await prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundError('Strategy not found');
    }

    // 檢查是否為該用戶的策略
    if (strategy.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // 驗證 category 必須是有效的值
    const validCategories = ['TREND_FOLLOWING', 'CONTRARIAN', 'DAY_TRADING', 'DIVIDEND_INVESTING'];
    if (data.category !== undefined && data.category !== null && !validCategories.includes(data.category)) {
      throw new AppError(
        `Category must be one of: ${validCategories.join(', ')}`,
        400
      );
    }

    return await prisma.strategy.update({
      where: { id },
      data,
    });
  }

  async deleteStrategy(id, userId) {
    const strategy = await prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundError('Strategy not found');
    }

    // 檢查是否為該用戶的策略
    if (strategy.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    await prisma.strategy.delete({
      where: { id },
    });

    return { message: 'Strategy deleted successfully' };
  }

  /**
   * 從交易資料計算策略績效
   * @param {string} strategyId - 策略 ID
   * @param {Date} periodStart - 統計期間開始（可選）
   * @param {Date} periodEnd - 統計期間結束（可選）
   * @returns {Promise<Object>} 績效資料
   */
  async calculatePerformanceFromTrades(strategyId, periodStart = null, periodEnd = null) {
    // 建立時間範圍條件
    const dateFilter = {};
    if (periodStart) {
      dateFilter.gte = periodStart;
    }
    if (periodEnd) {
      dateFilter.lte = periodEnd;
    }

    // 取得該策略的所有已結束交易
    const whereClause = {
      status: 'closed',
      closedAt: { not: null },
      OR: [
        { strategyId },
        { strategies: { some: { strategyId } } }
      ],
    };

    // 如果有時間範圍，加入 closedAt 條件
    if (Object.keys(dateFilter).length > 0) {
      whereClause.closedAt = dateFilter;
    }

    const trades = await prisma.trade.findMany({
      where: whereClause,
      select: {
        netProfitLoss: true,
        holdingDuration: true,
        closedAt: true,
        createdAt: true,
      },
      orderBy: { closedAt: 'asc' },
    });

    if (trades.length === 0) {
      return {
        totalProfitLoss: 0,
        winRate: null,
        riskRewardRatio: null,
        avgHoldingDuration: null,
        maxDrawdown: null,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
      };
    }

    // 計算總盈虧
    const totalProfitLoss = trades.reduce((sum, trade) => 
      sum + (trade.netProfitLoss || 0), 0
    );

    // 計算勝率
    const winningTrades = trades.filter(t => (t.netProfitLoss || 0) > 0);
    const losingTrades = trades.filter(t => (t.netProfitLoss || 0) < 0);
    const winRate = trades.length > 0 
      ? (winningTrades.length / trades.length) * 100 
      : null;

    // 計算風險報酬比（平均獲利 / 平均虧損）
    const profits = winningTrades.map(t => t.netProfitLoss);
    const losses = losingTrades.map(t => Math.abs(t.netProfitLoss));
    
    const avgProfit = profits.length > 0 
      ? profits.reduce((a, b) => a + b, 0) / profits.length 
      : 0;
    const avgLoss = losses.length > 0 
      ? losses.reduce((a, b) => a + b, 0) / losses.length 
      : 0;
    
    const riskRewardRatio = avgLoss > 0 ? avgProfit / avgLoss : null;

    // 計算平均持倉時間
    const durations = trades
      .filter(t => t.holdingDuration !== null && t.holdingDuration !== undefined)
      .map(t => Number(t.holdingDuration));
    const avgHoldingDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

    // 計算最大回撤（從最高點到最低點的跌幅）
    let peak = 0;
    let maxDrawdown = 0;
    let cumulativeProfit = 0;

    for (const trade of trades) {
      cumulativeProfit += (trade.netProfitLoss || 0);
      if (cumulativeProfit > peak) {
        peak = cumulativeProfit;
      }
      const drawdown = peak > 0 
        ? ((cumulativeProfit - peak) / peak) * 100 
        : 0;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalProfitLoss,
      winRate: winRate !== null ? Number(winRate.toFixed(2)) : null,
      riskRewardRatio: riskRewardRatio !== null ? Number(riskRewardRatio.toFixed(2)) : null,
      avgHoldingDuration: avgHoldingDuration !== null ? Number(avgHoldingDuration.toFixed(1)) : null,
      maxDrawdown: maxDrawdown !== 0 ? Number(maxDrawdown.toFixed(2)) : null,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
    };
  }

  /**
   * 計算並建立或更新當前快照
   * @param {string} strategyId - 策略 ID
   * @param {Date} periodStart - 統計期間開始（可選）
   * @param {Date} periodEnd - 統計期間結束（可選）
   * @returns {Promise<Object>} 績效快照
   */
  async calculateAndCreateSnapshot(strategyId, periodStart = null, periodEnd = null) {
    // 計算績效
    const performance = await this.calculatePerformanceFromTrades(
      strategyId, 
      periodStart, 
      periodEnd
    );

    // 取得當前快照
    const current = await prisma.strategyPerformance.findFirst({
      where: { 
        strategyId, 
        isCurrentSnapshot: true,
        ...(periodStart === null && periodEnd === null ? {} : {
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
        })
      }
    });

    const snapshotDate = periodEnd || new Date();

    if (current) {
      // 更新現有快照
      return await prisma.strategyPerformance.update({
        where: { id: current.id },
        data: {
          ...performance,
          sourceType: 'auto',
          snapshotDate,
          periodStart,
          periodEnd,
        }
      });
    } else {
      // 建立新快照
      return await prisma.strategyPerformance.create({
        data: {
          strategyId,
          ...performance,
          isCurrentSnapshot: periodStart === null && periodEnd === null, // 只有全部歷史才是當前快照
          sourceType: 'auto',
          snapshotDate,
          periodStart,
          periodEnd,
        }
      });
    }
  }

  /**
   * 取得策略的當前績效快照
   * @param {string} strategyId - 策略 ID
   * @param {string} userId - 使用者 ID（用於權限檢查）
   * @returns {Promise<Object>} 績效快照
   */
  async getCurrentPerformance(strategyId, userId) {
    // 驗證策略權限
    await this.getStrategyById(strategyId, userId);

    // 取得當前快照
    let performance = await prisma.strategyPerformance.findFirst({
      where: { 
        strategyId, 
        isCurrentSnapshot: true 
      }
    });

    // 如果沒有快照，自動計算並建立
    if (!performance) {
      performance = await this.calculateAndCreateSnapshot(strategyId);
    }

    return performance;
  }

  /**
   * 手動更新績效（使用者直接輸入）
   * @param {string} strategyId - 策略 ID
   * @param {Object} data - 績效資料
   * @param {string} userId - 使用者 ID
   * @returns {Promise<Object>} 更新後的績效快照
   */
  async updatePerformanceManually(strategyId, data, userId) {
    // 驗證權限
    await this.getStrategyById(strategyId, userId);

    // 取得或建立當前快照
    let current = await prisma.strategyPerformance.findFirst({
      where: { strategyId, isCurrentSnapshot: true }
    });

    if (!current) {
      // 如果沒有快照，先建立一個
      current = await prisma.strategyPerformance.create({
        data: {
          strategyId,
          isCurrentSnapshot: true,
          sourceType: 'manual',
          snapshotDate: new Date(),
          periodStart: null,
          periodEnd: null,
        }
      });
    }

    // 更新為手動輸入的數值
    return await prisma.strategyPerformance.update({
      where: { id: current.id },
      data: {
        totalProfitLoss: data.totalProfitLoss,
        winRate: data.winRate,
        riskRewardRatio: data.riskRewardRatio,
        avgHoldingDuration: data.avgHoldingDuration,
        maxDrawdown: data.maxDrawdown,
        totalTrades: data.totalTrades,
        winningTrades: data.winningTrades,
        losingTrades: data.losingTrades,
        sourceType: 'manual', // 標記為手動輸入
      }
    });
  }

  /**
   * 取得策略的所有快照
   * @param {string} strategyId - 策略 ID
   * @param {string} userId - 使用者 ID
   * @returns {Promise<Array>} 快照列表
   */
  async getStrategySnapshots(strategyId, userId) {
    // 驗證權限
    await this.getStrategyById(strategyId, userId);

    return await prisma.strategyPerformance.findMany({
      where: { strategyId },
      orderBy: { snapshotDate: 'desc' },
    });
  }

  /**
   * 建立特定期間的快照
   * @param {string} strategyId - 策略 ID
   * @param {Date} periodStart - 期間開始
   * @param {Date} periodEnd - 期間結束
   * @param {string} userId - 使用者 ID
   * @returns {Promise<Object>} 新建立的快照
   */
  async createPeriodSnapshot(strategyId, periodStart, periodEnd, userId) {
    // 驗證權限
    await this.getStrategyById(strategyId, userId);

    // 計算該期間的績效
    const performance = await this.calculatePerformanceFromTrades(
      strategyId, 
      periodStart, 
      periodEnd
    );

    // 建立新快照（不設為當前快照）
    return await prisma.strategyPerformance.create({
      data: {
        strategyId,
        ...performance,
        isCurrentSnapshot: false, // 歷史快照
        sourceType: 'auto',
        snapshotDate: periodEnd,
        periodStart,
        periodEnd,
      }
    });
  }

  /**
   * 更新 getStrategyById 以包含績效資料
   */
  async getStrategyByIdWithPerformance(id, userId) {
    const strategy = await prisma.strategy.findUnique({
      where: { id },
      include: {
        performance: {
          where: { isCurrentSnapshot: true },
          take: 1,
        }
      }
    });

    if (!strategy) {
      throw new NotFoundError('Strategy not found');
    }

    // 檢查是否為該用戶的策略
    if (strategy.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // 如果沒有快照，自動計算並建立
    if (!strategy.performance || strategy.performance.length === 0) {
      const performance = await this.calculateAndCreateSnapshot(id);
      strategy.performance = [performance];
    }

    return strategy;
  }
}

export default new StrategyService();
