/**
 * Trade DTO (Data Transfer Object)
 * 負責轉換後端 API 資料格式與前端資料格式
 * 
 * 採用方案 A：前端改用後端命名
 */

import { formatDate } from '@/utils/dateHelper'

/**
 * 轉換方向：API 格式 → 前端格式
 * @param {string} direction API 的 direction ("long" | "short")
 * @returns {string} 前端的 direction ("long" | "short")
 */
const convertDirection = (direction) => {
  // 後端已改為使用 long/short，直接返回，不需要轉換
  return direction
}

/**
 * 轉換狀態：API 格式 → 前端格式
 * @param {string} status API 的 status ("open" | "closed")
 * @returns {string} 前端的 status ("open" | "completed")
 */
const convertStatus = (status) => {
  const statusMap = {
    open: 'open',
    closed: 'completed',
  }
  return statusMap[status] || status
}

/**
 * 轉換紀律：API 格式 → 前端格式
 * @param {string|boolean|null} followedDiscipline API 的 followedDiscipline ("yes" | "no" | true | false | null)
 * @returns {string} 前端的 discipline ("pass" | "fail" | "pending")
 */
const convertDiscipline = (followedDiscipline) => {
  if (followedDiscipline === true || followedDiscipline === 'yes') return 'pass'
  if (followedDiscipline === false || followedDiscipline === 'no') return 'fail'
  return 'pending'
}

/**
 * 轉換倉位調整（Position）：API 格式 → 前端格式
 * @param {Object} adjustment API 的 positionAdjustment
 * @returns {Object} 前端的 position
 */
const convertPosition = (adjustment) => {
  return {
    key: adjustment.id,
    id: adjustment.id,
    date: formatDate(adjustment.timestamp) || formatDate(adjustment.createdAt),
    action: adjustment.action, // "buy" | "sell" 保持不變
    price: parseFloat(adjustment.price) || 0,
    shares: adjustment.shares || 0, // 改用後端命名
    stopLoss: adjustment.stopLoss ? parseFloat(adjustment.stopLoss) : null,
    note: adjustment.note || '', // 改用後端命名
  }
}

/**
 * 轉換交易記錄：API 格式 → 前端格式
 * @param {Object} apiTrade API 的交易記錄
 * @returns {Object} 前端的交易記錄
 */
export const tradeDTO = {
  /**
   * 將 API 的交易記錄轉換為前端格式
   * @param {Object} apiTrade API 的交易記錄
   * @returns {Object} 前端的交易記錄（使用後端命名）
   */
  toFrontend(apiTrade) {
    if (!apiTrade) return null

    return {
      key: apiTrade.id,
      id: apiTrade.id,
      symbol: apiTrade.symbol || '',
      assetType: apiTrade.assetType || 'stock',
      // 處理策略欄位：可能是字符串、對象或 null
      strategy: (() => {
        if (!apiTrade.strategy) return ''
        // 如果是對象，提取 name
        if (typeof apiTrade.strategy === 'object' && apiTrade.strategy !== null) {
          return apiTrade.strategy.name || ''
        }
        // 如果是字符串，直接返回
        return apiTrade.strategy
      })(),
      strategyId: apiTrade.strategyId || (typeof apiTrade.strategy === 'object' && apiTrade.strategy !== null ? apiTrade.strategy.id : null) || null, // 策略 ID
      entryCount: apiTrade.entryCount || 0, // 建倉次數
      holdingDuration: apiTrade.holdingDuration ? parseFloat(apiTrade.holdingDuration) : null, // 持有天數
      direction: convertDirection(apiTrade.direction),
      status: convertStatus(apiTrade.status),
      createdAt: formatDate(apiTrade.createdAt),
      closedAt: formatDate(apiTrade.closedAt),
      updatedAt: formatDate(apiTrade.updatedAt),
      
      // 持倉統計（以後端欄位為主）
      totalShares: apiTrade.totalShares || 0,
      avgPrice: apiTrade.avgPrice ? parseFloat(apiTrade.avgPrice) : 0,
      avgSellPrice: apiTrade.avgSellPrice != null ? parseFloat(apiTrade.avgSellPrice) : null,
      totalValue: apiTrade.totalValue ? parseFloat(apiTrade.totalValue) : 0,
      positionNote: apiTrade.positionNote || '',
      
      // 盈虧分析（以後端欄位為主）
      grossProfitLoss: apiTrade.grossProfitLoss !== null ? parseFloat(apiTrade.grossProfitLoss) : null,
      profitLoss: apiTrade.profitLoss !== null ? parseFloat(apiTrade.profitLoss) : (apiTrade.grossProfitLoss !== null ? parseFloat(apiTrade.grossProfitLoss) : null), // 保留舊欄位，優先使用 profitLoss
      profitLossRatio: apiTrade.profitLossRatio !== null ? parseFloat(apiTrade.profitLossRatio) : null,
      totalFee: apiTrade.totalFee !== null ? parseFloat(apiTrade.totalFee) : null,
      totalTax: apiTrade.totalTax !== null ? parseFloat(apiTrade.totalTax) : null,
      netProfitLoss: apiTrade.netProfitLoss !== null ? parseFloat(apiTrade.netProfitLoss) : null,
      
      // 檢討（以後端欄位為主）
      reviewNotes: apiTrade.reviewNotes || '',
      errorCategory: apiTrade.errorCategory || '',
      emotion: apiTrade.emotion || '',
      followedDiscipline: convertDiscipline(apiTrade.followedDiscipline),
      selfRating: apiTrade.selfRating !== null ? parseFloat(apiTrade.selfRating) : 0,
      exitReason: apiTrade.exitReason || '',
      
      // 倉位調整
      positionAdjustments: (apiTrade.positionAdjustments || []).map(convertPosition),
      
      // 保留原始資料以備不時之需
      _raw: apiTrade,
    }
  },

  /**
   * 將多筆 API 交易記錄轉換為前端格式
   * @param {Array|Object} apiData API 的資料（可能是陣列或 { list, total, ... } 格式）
   * @returns {Array|Object} 轉換後的資料
   */
  toFrontendList(apiData) {
    if (!apiData) {
      console.warn('[tradeDTO.toFrontendList] apiData is null/undefined')
      return []
    }

    // console.log('[tradeDTO.toFrontendList] apiData:', apiData)
    // console.log('[tradeDTO.toFrontendList] apiData type:', typeof apiData, 'isArray:', Array.isArray(apiData))
    // console.log('[tradeDTO.toFrontendList] apiData keys:', Object.keys(apiData))

    // 如果 API 直接返回陣列
    if (Array.isArray(apiData)) {
      // console.log('[tradeDTO.toFrontendList] Using array format, count:', apiData.length)
      return apiData.map(item => this.toFrontend(item))
    }

    // 如果 API 返回 { list, pagination: { total, page, limit } } 或 { list, total, page, limit } 格式
    if (apiData.list && Array.isArray(apiData.list)) {
      const pg = apiData.pagination || apiData
      return {
        list: apiData.list.map(item => this.toFrontend(item)),
        total: pg.total || apiData.list.length,
        page: pg.page || 1,
        pageSize: pg.limit || pg.pageSize || 10,
      }
    }

    // 如果 API 返回 { data: [...], pagination: { total, page, limit } } 格式
    if (apiData.data && Array.isArray(apiData.data)) {
      const pg = apiData.pagination || apiData
      return {
        list: apiData.data.map(item => this.toFrontend(item)),
        total: pg.total || apiData.data.length,
        page: pg.page || 1,
        pageSize: pg.limit || pg.pageSize || 10,
      }
    }

    // 如果 API 返回 { trades: [...] } 或其他欄位名
    // 嘗試找到第一個陣列類型的屬性
    for (const key in apiData) {
      if (Array.isArray(apiData[key])) {
        console.log(`[tradeDTO.toFrontendList] Using apiData.${key} format, count:`, apiData[key].length)
        return {
          list: apiData[key].map(item => this.toFrontend(item)),
          total: apiData.total || apiData[key].length,
          page: apiData.page || 1,
          pageSize: apiData.limit || apiData.pageSize || 10,
        }
      }
    }

    console.warn('[tradeDTO.toFrontendList] Unknown format, returning empty array. apiData:', apiData)
    return []
  },

  /**
   * 將前端的交易記錄轉換為 API 格式（用於新增/更新）
   * @param {Object} frontendTrade 前端的交易記錄（使用後端命名）
   * @returns {Object} API 的交易記錄
   */
  toAPI(frontendTrade) {
    if (!frontendTrade) return null

    const statusMap = {
      open: 'open',
      completed: 'closed',
    }

    const disciplineMap = {
      pass: 'yes',
      fail: 'no',
      pending: null,
      yes: 'yes',
      no: 'no',
    }

    // 後端已改為使用 long/short，直接使用，不需要轉換
    const isDirectionAPIFormat = frontendTrade.direction === 'long' || frontendTrade.direction === 'short'
    const isStatusAPIFormat = frontendTrade.status === 'open' || frontendTrade.status === 'closed'
    const isDisciplineAPIFormat = frontendTrade.followedDiscipline === 'yes' || frontendTrade.followedDiscipline === 'no' || 
                                  frontendTrade.followedDiscipline === true || frontendTrade.followedDiscipline === false ||
                                  frontendTrade.followedDiscipline === null

    // 處理 followedDiscipline 轉換
    let followedDisciplineValue = frontendTrade.followedDiscipline
    if (!isDisciplineAPIFormat) {
      if (disciplineMap[frontendTrade.followedDiscipline] !== undefined) {
        followedDisciplineValue = disciplineMap[frontendTrade.followedDiscipline]
      } else if (frontendTrade.followedDiscipline === true) {
        followedDisciplineValue = 'yes'
      } else if (frontendTrade.followedDiscipline === false) {
        followedDisciplineValue = 'no'
      }
    } else if (typeof frontendTrade.followedDiscipline === 'boolean') {
      followedDisciplineValue = frontendTrade.followedDiscipline ? 'yes' : 'no'
    }

    return {
      symbol: frontendTrade.symbol,
      direction: frontendTrade.direction, // 後端已改為使用 long/short，直接使用
      status: isStatusAPIFormat
        ? frontendTrade.status
        : (statusMap[frontendTrade.status] || frontendTrade.status),
      strategyId: frontendTrade.strategyId || frontendTrade.strategy || null, // 策略 ID（優先使用 strategyId，否則使用 strategy）
      createdAt: frontendTrade.createdAt || null, // 開倉日
      followedDiscipline: followedDisciplineValue,
      // 檢討相關欄位
      reviewNotes: frontendTrade.reviewNotes || frontendTrade.review?.content || null,
      errorCategory: frontendTrade.errorCategory || null,
      emotion: frontendTrade.emotion || null,
      selfRating: frontendTrade.selfRating !== null && frontendTrade.selfRating !== undefined
        ? parseFloat(frontendTrade.selfRating)
        : null,
      exitReason: frontendTrade.exitReason || null,
      // 同時建立首筆倉位（atomic，後端在 transaction 中一起寫入）
      ...(frontendTrade.firstPosition && { firstPosition: frontendTrade.firstPosition }),
      // 同步補入金（atomic，後端在 transaction 中一起寫入）
      ...(frontendTrade.deposit && { deposit: frontendTrade.deposit }),
    }
  },
}

export default tradeDTO
