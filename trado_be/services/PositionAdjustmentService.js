import prisma from '../config/database.js';
import { NotFoundError, AppError } from '../errors/index.js';
import tradeService from './TradeService.js';

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
