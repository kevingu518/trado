import dayjs from 'dayjs'

/**
 * Strategy DTO
 * 負責轉換後端 API 資料格式與前端資料格式
 */

// 格式化日期
const formatDate = (date) => {
  if (!date) return null
  if (dayjs.isDayjs(date)) {
    return date.format('YYYY-MM-DD')
  }
  if (typeof date === 'string') {
    return dayjs(date).format('YYYY-MM-DD')
  }
  return date
}

export const strategyDTO = {
  /**
   * 將後端 API 資料轉換為前端格式（單筆）
   */
  toFrontend(apiStrategy) {
    if (!apiStrategy) return null

    return {
      id: apiStrategy.id,
      userId: apiStrategy.userId,
      name: apiStrategy.name || '',
      description: apiStrategy.description || '',
      category: apiStrategy.category || 'TREND_FOLLOWING', // 後端使用 category
      type: apiStrategy.category || 'TREND_FOLLOWING', // 保留 type 作為 category 的別名，方便前端使用
      note: apiStrategy.note || '',
      stockSelectionCriteria: apiStrategy.stockSelectionCriteria || '',
      entryConditions: apiStrategy.entryConditions || '',
      exitConditions: apiStrategy.exitConditions || '',
      riskManagement: apiStrategy.riskManagement || '',
      maxDrawdownTolerance: apiStrategy.maxDrawdownTolerance ? parseFloat(apiStrategy.maxDrawdownTolerance) : null,
      expectedWinRate: apiStrategy.expectedWinRate ? parseFloat(apiStrategy.expectedWinRate) : null,
      expectedProfitLossRatio: apiStrategy.expectedProfitLossRatio ? parseFloat(apiStrategy.expectedProfitLossRatio) : null,
      watchlistTrigger: apiStrategy.watchlistTrigger || '',
      addPositionRules: apiStrategy.addPositionRules || '',
      isActive: apiStrategy.isActive !== undefined ? apiStrategy.isActive : true,
      createdAt: formatDate(apiStrategy.createdAt),
      updatedAt: formatDate(apiStrategy.updatedAt),
      // 統計資料（可選，如果後端有提供）
      // 注意：後端 winRate / maxDrawdown 以百分比儲存 (0~100)，前端統一轉為 0~1 小數，顯示時再乘 100
      stats: apiStrategy.stats ? {
        totalProfitLoss: apiStrategy.stats.totalProfitLoss !== null && apiStrategy.stats.totalProfitLoss !== undefined ? parseFloat(apiStrategy.stats.totalProfitLoss) : null,
        winRate: apiStrategy.stats.winRate !== null && apiStrategy.stats.winRate !== undefined ? parseFloat(apiStrategy.stats.winRate) / 100 : null,
        riskRewardRatio: apiStrategy.stats.riskRewardRatio !== null && apiStrategy.stats.riskRewardRatio !== undefined ? parseFloat(apiStrategy.stats.riskRewardRatio) : null,
        avgHoldingDuration: apiStrategy.stats.avgHoldingDuration !== null && apiStrategy.stats.avgHoldingDuration !== undefined ? parseFloat(apiStrategy.stats.avgHoldingDuration) : null,
        maxDrawdown: apiStrategy.stats.maxDrawdown !== null && apiStrategy.stats.maxDrawdown !== undefined ? parseFloat(apiStrategy.stats.maxDrawdown) / 100 : null,
        totalTrades: apiStrategy.stats.totalTrades || 0,
        winningTrades: apiStrategy.stats.winningTrades || 0,
        losingTrades: apiStrategy.stats.losingTrades || 0,
        // 保留舊欄位以向後兼容
        avgProfit: apiStrategy.stats.avgProfit !== null && apiStrategy.stats.avgProfit !== undefined ? parseFloat(apiStrategy.stats.avgProfit) : null,
      } : null,
    }
  },

  /**
   * 將後端 API 資料轉換為前端格式（列表）
   * 後端回應格式：{ success: true, data: [...], pagination: {...} }
   * 注意：request.js 的響應攔截器會返回 response.data.data，所以這裡接收的可能是：
   * 1. 陣列（如果後端直接返回 data 陣列）
   * 2. 物件 { data: [...], pagination: {...} }（如果後端返回完整格式）
   */
  toFrontendList(apiResponse) {
    if (!apiResponse) return { list: [], total: 0, page: 1, pageSize: 20, pagination: null }

    // 如果 apiResponse 是陣列（request.js 攔截器返回了 response.data.data）
    if (Array.isArray(apiResponse)) {
      return {
        list: apiResponse.map(item => this.toFrontend(item)),
        total: apiResponse.length,
        page: 1,
        pageSize: apiResponse.length,
        pagination: null,
      }
    }

    // 如果 apiResponse 是物件，可能包含 data 和 pagination
    // 情況1：{ data: [...], pagination: {...} }（request.js 返回了 response.data）
    if (apiResponse.data && Array.isArray(apiResponse.data)) {
      const data = apiResponse.data
      const pagination = apiResponse.pagination || {}

      return {
        list: data.map(item => this.toFrontend(item)),
        total: pagination.total || data.length,
        page: pagination.page || 1,
        pageSize: pagination.limit || 20,
        totalPages: pagination.totalPages || Math.ceil((pagination.total || data.length) / (pagination.limit || 20)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false,
        pagination, // 保留完整的 pagination 物件
      }
    }

    // 情況2：如果 apiResponse 本身就是策略物件（單筆）
    if (apiResponse.id) {
      return {
        list: [this.toFrontend(apiResponse)],
        total: 1,
        page: 1,
        pageSize: 1,
        pagination: null,
      }
    }

    // 預設返回空列表
    return { list: [], total: 0, page: 1, pageSize: 20, pagination: null }
  },

  /**
   * 將前端資料轉換為後端 API 格式
   */
  toAPI(frontendStrategy) {
    if (!frontendStrategy) return null

    return {
      name: frontendStrategy.name,
      description: frontendStrategy.description || '',
      category: frontendStrategy.category || frontendStrategy.type || 'TREND_FOLLOWING', // 優先使用 category
      note: frontendStrategy.note || '',
      stockSelectionCriteria: frontendStrategy.stockSelectionCriteria || '',
      entryConditions: frontendStrategy.entryConditions || '',
      exitConditions: frontendStrategy.exitConditions || '',
      riskManagement: frontendStrategy.riskManagement || '',
      maxDrawdownTolerance: frontendStrategy.maxDrawdownTolerance !== undefined ? String(frontendStrategy.maxDrawdownTolerance) : null,
      expectedWinRate: frontendStrategy.expectedWinRate !== undefined ? String(frontendStrategy.expectedWinRate) : null,
      expectedProfitLossRatio: frontendStrategy.expectedProfitLossRatio !== undefined ? String(frontendStrategy.expectedProfitLossRatio) : null,
      watchlistTrigger: frontendStrategy.watchlistTrigger || '',
      addPositionRules: frontendStrategy.addPositionRules || '',
      isActive: frontendStrategy.isActive !== undefined ? frontendStrategy.isActive : true,
    }
  },
}
