// src/features/trades/services/positionDTO.js
import { formatDate } from '@/utils/dateHelper'

/**
 * Position DTO
 * 處理前端和後端資料格式的轉換
 */

export const positionDTO = {
  /**
   * 將 API 的倉位資料轉換為前端格式
   * @param {Object} apiPosition API 的倉位資料
   * @returns {Object} 前端的倉位資料
   */
  toFrontend(apiPosition) {
    if (!apiPosition) return null

    return {
      key: apiPosition.id,
      id: apiPosition.id,
      tradeId: apiPosition.tradeId,
      date: formatDate(apiPosition.timestamp || apiPosition.createdAt),
      action: apiPosition.action, // "buy" | "sell"
      price: parseFloat(apiPosition.price) || 0,
      shares: apiPosition.shares || 0,
      stopLoss: apiPosition.stopLoss ? parseFloat(apiPosition.stopLoss) : null,
      note: apiPosition.note || '',
      fee: apiPosition.fee ? parseFloat(apiPosition.fee) : 0,
      createdAt: formatDate(apiPosition.createdAt),
      updatedAt: formatDate(apiPosition.updatedAt),
      _raw: apiPosition,
    }
  },

  /**
   * 將 API 的倉位列表轉換為前端格式
   * @param {Object|Array} apiData API 的倉位資料（可能是列表或單一物件）
   * @returns {Array|Object} 前端的倉位資料
   */
  toFrontendList(apiData) {
    if (!apiData) return []
    
    if (apiData.list && Array.isArray(apiData.list)) {
      return {
        list: apiData.list.map(item => this.toFrontend(item)),
        total: apiData.total || 0,
        page: apiData.page || 1,
        pageSize: apiData.pageSize || 10,
      }
    }
    
    if (Array.isArray(apiData)) {
      return apiData.map(item => this.toFrontend(item))
    }
    
    return []
  },

  /**
   * 將前端的倉位資料轉換為 API 格式
   * @param {Object} frontendPosition 前端的倉位資料
   * @returns {Object} API 的倉位資料
   */
  toAPI(frontendPosition) {
    if (!frontendPosition) return null

    // 處理 timestamp：如果是 dayjs 物件，轉換為字符串；如果是字符串，直接使用（選填）
    let timestamp = ''
    if (frontendPosition.date) {
      if (typeof frontendPosition.date === 'string') {
        timestamp = frontendPosition.date
      } else if (frontendPosition.date.format) {
        // dayjs 物件
        timestamp = frontendPosition.date.format('YYYY-MM-DD')
      }
    } else if (frontendPosition.timestamp) {
      timestamp = frontendPosition.timestamp
    }

    const payload = {
      action: frontendPosition.action, // "buy" | "sell"
      shares: frontendPosition.shares || 0,
      price: parseFloat(frontendPosition.price) || 0,
    }

    // 選填欄位：只有有值時才加入
    if (timestamp) {
      payload.timestamp = timestamp
    }
    if (frontendPosition.stopLoss !== undefined && frontendPosition.stopLoss !== null) {
      payload.stopLoss = parseFloat(frontendPosition.stopLoss)
    }
    if (frontendPosition.note !== undefined && frontendPosition.note !== null && frontendPosition.note !== '') {
      payload.note = frontendPosition.note
    }

    return payload
  },
}

export default positionDTO
