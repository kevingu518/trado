import { getDailyPositionsApi } from '@api/api_trade'
import { dailyPositionDTO } from './dailyPositionDTO'

/**
 * Daily Positions Service
 * - 透過 api_trade.js 取得每日進出倉位
 * - 用 DTO 轉換為前端格式
 */

export const dailyPositionsService = {
  /**
   * 取得每日進出倉位
   * @param {Object} params { page, pageSize, startDate, endDate, symbol, direction, action, sortOrder }
   */
  async fetchDailyPositions(params = {}) {
    const apiParams = { ...params }
    if (apiParams.pageSize !== undefined) {
      apiParams.limit = apiParams.pageSize
      delete apiParams.pageSize
    }
    const apiResponse = await getDailyPositionsApi(apiParams)
    return dailyPositionDTO.toFrontendList(apiResponse)
  },
}

export default dailyPositionsService
