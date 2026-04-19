import prisma from '../config/database.js';
import { NotFoundError, AppError } from '../errors/index.js';
import tradeService from './TradeService.js';
import { calculateFee, calculateTax } from '../utils/feeCalculator.js';

class PositionAdjustmentService {
  /**
   * 處理 timestamp 格式：如果只有日期，補上時間部分
   * @param {string|Date} timestamp - 時間戳記
   * @returns {Date} 處理後的 Date 物件
   */
  normalizeTimestamp(timestamp) {
    if (!timestamp) return timestamp;
    
    // 如果已經是 Date 物件，直接返回
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    const timestampStr = String(timestamp);
    
    // 如果只有日期（格式：YYYY-MM-DD），補上時間
    if (/^\d{4}-\d{2}-\d{2}$/.test(timestampStr)) {
      return new Date(timestampStr + 'T00:00:00.000Z');
    }
    
    // 如果已經是完整的 ISO 格式，直接轉換為 Date
    return new Date(timestampStr);
  }

  /**
   * 處理資料中的 timestamp 欄位
   * @param {Object} data - 要處理的資料物件
   * @returns {Object} 處理後的資料物件
   */
  processTimestamp(data) {
    const processedData = { ...data };
    if (processedData.timestamp !== undefined) {
      processedData.timestamp = this.normalizeTimestamp(processedData.timestamp);
    }
    return processedData;
  }

  async getAdjustmentsByTradeId(tradeId, userId) {
    // 確認交易存在且屬於該用戶
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundError('Trade not found');
    }

    // 檢查是否為該用戶的交易
    if (trade.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return await prisma.positionAdjustment.findMany({
      where: { 
        tradeId,
        deletedAt: null,  // 只取得未刪除的記錄
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async createAdjustment(tradeId, data, userId) {
    // 確認交易存在且屬於該用戶
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundError('Trade not found');
    }

    // 檢查是否為該用戶的交易
    if (trade.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // 處理 timestamp 格式
    const processedData = this.processTimestamp(data);

    // 自動計算手續費（如果前端沒傳或傳 null）
    if (processedData.fee == null) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { brokerFeeDiscount: true },
      });
      const discount = user?.brokerFeeDiscount ? Number(user.brokerFeeDiscount) : 1.0;
      processedData.fee = calculateFee(processedData.shares, processedData.price, discount);
    }

    // 賣出時自動計算證交稅
    if (processedData.action === 'sell') {
      // 自動偵測當沖：同 trade 同天有 buy
      if (processedData.isDayTrade == null && processedData.timestamp) {
        const sellDate = new Date(processedData.timestamp).toISOString().slice(0, 10);
        const sameDayBuy = await prisma.positionAdjustment.findFirst({
          where: {
            tradeId,
            action: 'buy',
            deletedAt: null,
            timestamp: {
              gte: new Date(sellDate + 'T00:00:00.000Z'),
              lte: new Date(sellDate + 'T23:59:59.999Z'),
            },
          },
        });
        processedData.isDayTrade = sameDayBuy !== null;
      }

      if (processedData.tax == null) {
        processedData.tax = calculateTax(
          processedData.shares,
          processedData.price,
          processedData.isDayTrade || false,
        );
      }
    }

    const adjustment = await prisma.positionAdjustment.create({
      data: {
        ...processedData,
        tradeId,
      },
    });

    // 建立後自動計算並更新 Trade 的 totalShares 和 avgPrice
    await tradeService.calculateTradeMetrics(tradeId);

    return adjustment;
  }

  async getAdjustmentById(positionId, userId) {
    const adjustment = await prisma.positionAdjustment.findUnique({
      where: { id: positionId },
      include: {
        trade: true,
      },
    });

    if (!adjustment) {
      throw new NotFoundError('Position adjustment not found');
    }

    // 檢查是否已刪除
    if (adjustment.deletedAt) {
      throw new NotFoundError('Position adjustment not found');
    }

    // 檢查是否為該用戶的交易
    if (adjustment.trade.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return adjustment;
  }

  async updateAdjustment(positionId, data, userId) {
    // 先取得 adjustment 並驗證權限
    const adjustment = await this.getAdjustmentById(positionId, userId);

    // 處理 timestamp 格式
    const processedData = this.processTimestamp(data);

    // 判斷 shares 或 price 是否有變更
    const sharesChanged = processedData.shares != null && processedData.shares !== adjustment.shares;
    const priceChanged = processedData.price != null && String(processedData.price) !== String(adjustment.price);
    const amountChanged = sharesChanged || priceChanged;

    // 如果金額有變且前端沒傳 fee → 重新計算手續費
    if (amountChanged && processedData.fee == null) {
      const trade = await prisma.trade.findUnique({
        where: { id: adjustment.tradeId },
        select: { userId: true },
      });
      const user = await prisma.user.findUnique({
        where: { id: trade.userId },
        select: { brokerFeeDiscount: true },
      });
      const discount = user?.brokerFeeDiscount ? Number(user.brokerFeeDiscount) : 1.0;
      const newShares = processedData.shares ?? adjustment.shares;
      const newPrice = processedData.price ?? adjustment.price;
      processedData.fee = calculateFee(newShares, newPrice, discount);
    }

    // 如果是賣出且金額有變且前端沒傳 tax → 重新計算證交稅
    const action = processedData.action ?? adjustment.action;
    if (action === 'sell' && amountChanged && processedData.tax == null) {
      const newShares = processedData.shares ?? adjustment.shares;
      const newPrice = processedData.price ?? adjustment.price;
      const isDayTrade = processedData.isDayTrade ?? adjustment.isDayTrade;
      processedData.tax = calculateTax(newShares, newPrice, isDayTrade);
    }

    const updatedAdjustment = await prisma.positionAdjustment.update({
      where: { id: positionId },
      data: processedData,
    });

    // 更新後自動計算並更新 Trade 的 totalShares 和 avgPrice
    await tradeService.calculateTradeMetrics(adjustment.tradeId);

    return updatedAdjustment;
  }

  async deleteAdjustment(positionId, userId) {
    // 先取得 adjustment 並驗證權限
    const adjustment = await this.getAdjustmentById(positionId, userId);
    const tradeId = adjustment.tradeId;

    // 軟刪除：更新 deletedAt 而不是真的刪除
    await prisma.positionAdjustment.update({
      where: { id: positionId },
      data: {
        deletedAt: new Date(),
      },
    });

    // 刪除後自動計算並更新 Trade 的 totalShares 和 avgPrice
    await tradeService.calculateTradeMetrics(tradeId);

    return { message: 'Position adjustment deleted successfully' };
  }
}

export default new PositionAdjustmentService();
