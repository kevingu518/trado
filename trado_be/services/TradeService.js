import prisma from '../config/database.js';
import { NotFoundError, AppError } from '../errors/index.js';
import AccountService from './AccountService.js';

class TradeService {
  async getAllTrades(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      symbol,
      direction,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // 驗證參數
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); // 最多 100 筆
    const skip = (pageNum - 1) * limitNum;

    // 處理日期範圍
    const dateFilter = {};
    if (startDate) {
      // 如果只有日期（YYYY-MM-DD），補上時間部分為當天開始（00:00:00）
      const start = startDate.includes('T') 
        ? new Date(startDate) 
        : new Date(startDate + 'T00:00:00.000Z');
      dateFilter.gte = start;
    }
    if (endDate) {
      // 如果只有日期（YYYY-MM-DD），補上時間部分為當天結束（23:59:59.999）
      const end = endDate.includes('T')
        ? new Date(endDate)
        : new Date(endDate + 'T23:59:59.999Z');
      dateFilter.lte = end;
    }

    // 建立 where 條件
    const where = {
      userId,
      ...(status && { status }),
      ...(symbol && { symbol }),
      ...(direction && ['long', 'short'].includes(direction) && { direction }),
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    // 建立排序條件
    const orderBy = {};
    const validSortFields = ['createdAt', 'updatedAt', 'closedAt', 'symbol', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
    orderBy[sortField] = order;

    // 並行查詢：取得資料和總數
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: {
          positionAdjustments: {
            where: {
              deletedAt: null,  // 只取得未刪除的記錄
            },
            orderBy: {
              timestamp: 'asc', // adjustments 按時間排序
            },
          },
          strategy: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.trade.count({ where }),
    ]);

    // 處理策略欄位（從資料庫讀取 entryCount 和 holdingDuration，無需計算）
    const tradesWithMetrics = trades.map(trade => {
      // 取得策略（單一物件或 null）
      const strategy = trade.strategy ? {
        id: trade.strategy.id,
        name: trade.strategy.name,
        category: trade.strategy.category,
      } : null;

      // 移除原始的 strategy 關聯，避免混淆
      const { strategy: _, ...tradeWithoutStrategy } = trade;

      return {
        ...tradeWithoutStrategy,
        // entryCount 和 holdingDuration 已經從資料庫讀取，直接使用
        strategy,
      };
    });

    const totalPages = Math.ceil(total / limitNum);

    return {
      trades: tradesWithMetrics,
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

  async getTradeById(id, userId) {
    const trade = await prisma.trade.findUnique({
      where: { id },
      include: {
        positionAdjustments: {
          where: {
            deletedAt: null,  // 只取得未刪除的記錄
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
        strategy: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    if (!trade) {
      throw new NotFoundError('Trade not found');
    }

    // 檢查是否為該用戶的交易
    if (trade.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return trade;
  }

  async createTrade(data, userId) {
    // 驗證 direction 必須是 'long' 或 'short'
    if (data.direction && !['long', 'short'].includes(data.direction)) {
      throw new AppError('Direction must be either "long" or "short"', 400);
    }

    // 處理 createdAt（開倉日）
    const tradeData = {
      ...data,
      userId,
    };

    // 如果傳入了 createdAt，處理日期格式
    if (data.createdAt) {
      // 如果只有日期（YYYY-MM-DD），補上時間部分為當天開始（00:00:00）
      if (typeof data.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.createdAt)) {
        tradeData.createdAt = new Date(data.createdAt + 'T00:00:00.000Z');
      } else if (data.createdAt instanceof Date) {
        tradeData.createdAt = data.createdAt;
      } else {
        tradeData.createdAt = new Date(data.createdAt);
      }
    }

    // 驗證 strategyId 是否存在，如果不存在則設為 null（避免外鍵約束錯誤）
    if (data.strategyId) {
      const strategy = await prisma.strategy.findUnique({
        where: { id: data.strategyId },
        select: { id: true },
      });
      
      // 如果 strategy 不存在，設為 null（不存入資料庫）
      if (!strategy) {
        tradeData.strategyId = null;
      }
    }

    return await prisma.trade.create({
      data: tradeData,
      include: {
        positionAdjustments: true,
      },
    });
  }

  async updateTrade(id, data, userId) {
    const trade = await prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) {
      throw new NotFoundError('Trade not found');
    }

    // 檢查是否為該用戶的交易
    if (trade.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // 只允許更新檢討相關欄位
    const allowedFields = [
      'reviewNotes',
      'errorCategory',
      'emotion',
      'followedDiscipline',
      'selfRating',
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // 如果沒有可更新的欄位，拋出錯誤
    if (Object.keys(updateData).length === 0) {
      throw new AppError(
        'No valid fields to update. Only review-related fields are allowed: reviewNotes, errorCategory, emotion, followedDiscipline, selfRating',
        400
      );
    }

    return await prisma.trade.update({
      where: { id },
      data: updateData,
      include: {
        positionAdjustments: true,
      },
    });
  }

  async deleteTrade(id, userId) {
    const trade = await prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) {
      throw new NotFoundError('Trade not found');
    }

    // 檢查是否為該用戶的交易
    if (trade.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    await prisma.trade.delete({
      where: { id },
    });

    return { message: 'Trade deleted successfully' };
  }

  /**
   * 根據 positionAdjustments 計算並更新 Trade 的持倉統計和盈虧分析
   * @param {string} tradeId - Trade ID
   * @returns {Promise<{totalShares: number|null, avgPrice: number|null, totalValue: number|null, totalFee: number|null, entryCount: number|null, holdingDuration: number|null}>}
   */
  async calculateTradeMetrics(tradeId) {
    const adjustments = await prisma.positionAdjustment.findMany({
      where: { 
        tradeId,
        deletedAt: null,  // 只計算未刪除的記錄
      },
      orderBy: { timestamp: 'asc' },
    });

    // 取得當前 trade 的狀態和方向
    const currentTrade = await prisma.trade.findUnique({
      where: { id: tradeId },
      select: { status: true, closedAt: true, direction: true },
    });

    if (!currentTrade) {
      throw new NotFoundError('Trade not found');
    }

    if (adjustments.length === 0) {
      // 沒有 adjustments，清空相關欄位
      await prisma.trade.update({
        where: { id: tradeId },
        data: {
          totalShares: null,
          avgPrice: null,
          totalValue: null,
          totalFee: null,
          entryCount: 0,  // 沒有 adjustments 時，entryCount 應該是 0
          holdingDuration: null,
        },
      });
      return { 
        totalShares: null, 
        avgPrice: null, 
        totalValue: null,
        totalFee: null,
        entryCount: 0,  // 沒有 adjustments 時，entryCount 應該是 0
        holdingDuration: null,
      };
    }

    // 計算總股數和總成本
    let totalShares = 0;
    let totalCost = 0; // 總成本（含手續費）
    let totalFee = 0; // 總手續費
    let totalTax = 0; // 總證交稅
    let totalBuyCost = 0; // 買入總成本（不含手續費）
    let totalSellRevenue = 0; // 賣出總收入（不含手續費）

    for (const adj of adjustments) {
      const shares = adj.shares;
      const price = parseFloat(adj.price);
      const fee = adj.fee || 0;
      const tax = adj.tax || 0;
      totalFee += fee; // 累加所有手續費
      totalTax += tax; // 累加所有證交稅

      if (adj.action === 'buy') {
        // 買入：增加股數和成本
        totalShares += shares;
        totalCost += (shares * price) + fee;
        totalBuyCost += shares * price;
      } else if (adj.action === 'sell') {
        // 賣出：減少股數，成本按當前平均成本計算
        totalSellRevenue += shares * price;
        if (totalShares > 0) {
          const avgCostPerShare = totalCost / totalShares;
          const sharesToSell = Math.min(shares, totalShares);
          totalShares -= sharesToSell;
          totalCost -= (sharesToSell * avgCostPerShare) + fee;
        }
      }
    }

    // 計算平均價格（保留小數點後2位）
    const avgPrice = totalShares > 0 
      ? parseFloat((totalCost / totalShares).toFixed(2)) 
      : null;

    // 計算總價值（總股數 * 平均價格）
    const totalValue = totalShares > 0 && avgPrice
      ? parseFloat((totalShares * avgPrice).toFixed(2))
      : null;

    // 計算建倉次數（根據 direction 判斷）
    let entryCount = 0;
    if (currentTrade.direction === 'long') {
      // 多單：計算 buy 的次數
      entryCount = adjustments.filter(adj => adj.action === 'buy').length;
    } else if (currentTrade.direction === 'short') {
      // 空單：計算 sell 的次數
      entryCount = adjustments.filter(adj => adj.action === 'sell').length;
    } else {
      // 容錯處理：如果 direction 不是預期值，根據第一個 adjustment 的 action 判斷
      if (adjustments.length > 0) {
        const firstAction = adjustments[0].action;
        if (firstAction === 'buy') {
          // 如果第一個是 buy，假設是多單，計算 buy 的次數
          entryCount = adjustments.filter(adj => adj.action === 'buy').length;
        } else if (firstAction === 'sell') {
          // 如果第一個是 sell，假設是空單，計算 sell 的次數
          entryCount = adjustments.filter(adj => adj.action === 'sell').length;
        }
      }
    }

    // 計算持有時間（天數）
    let holdingDuration = null;
    if (adjustments.length > 0) {
      const firstTimestamp = adjustments[0].timestamp;
      const endTime = currentTrade.closedAt || new Date();
      const diffMs = endTime - firstTimestamp;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      holdingDuration = Math.max(0, parseFloat((Math.round(diffDays * 10) / 10).toFixed(1))); // 保留小數點後1位，最小為 0
    }

    // 判斷是否應該自動設為 closed（倉位為 0）
    const shouldBeClosed = totalShares === 0;

    // 計算損益（僅在已平倉時計算）
    let grossProfitLoss = null;
    let netProfitLoss = null;
    if (shouldBeClosed && adjustments.length > 0) {
      grossProfitLoss = Math.round(totalSellRevenue - totalBuyCost);
      netProfitLoss = Math.round(grossProfitLoss - totalFee - totalTax);
    }

    // 準備更新資料
    const updateData = {
      totalShares: totalShares > 0 ? totalShares : null,
      avgPrice: avgPrice ? avgPrice : null,
      totalValue: totalValue ? totalValue : null,
      totalFee: totalFee > 0 ? totalFee : null,
      totalTax: totalTax > 0 ? totalTax : null,
      entryCount: entryCount,  // 保留 0，不要設為 null
      holdingDuration: holdingDuration !== null ? holdingDuration : null,
      grossProfitLoss,
      netProfitLoss,
    };

    // 如果倉位為 0，自動設為 closed
    if (shouldBeClosed && currentTrade.status !== 'closed') {
      updateData.status = 'closed';
      // 如果還沒有 closedAt，設定為當前時間
      if (!currentTrade.closedAt) {
        updateData.closedAt = new Date();
      }
    }

    // 更新 Trade 表
    await prisma.trade.update({
      where: { id: tradeId },
      data: updateData,
    });

    // 每次 metrics 更新都觸發快照更新（因為交易會影響現金餘額）
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      select: { userId: true },
    });
    if (trade) {
      try {
        await AccountService.createOrUpdateSnapshot(trade.userId, new Date());
      } catch (err) {
        console.error('[TradeService] Failed to update snapshot:', err.message);
      }
    }

    return {
      totalShares: totalShares > 0 ? totalShares : null,
      avgPrice,
      totalValue,
      totalFee: totalFee > 0 ? totalFee : null,
      totalTax: totalTax > 0 ? totalTax : null,
      entryCount: entryCount,
      holdingDuration: holdingDuration !== null ? holdingDuration : null,
      grossProfitLoss,
      netProfitLoss,
      status: updateData.status || currentTrade.status,
    };
  }
}

export default new TradeService();
