import { 
  getTradesApi, 
  getTradeApi, 
  createTradeApi, 
  updateTradeApi, 
  deleteTradeApi 
} from '@api/api_trade'
import { tradeDTO } from './tradeDTO'

/**
 * Trades Service
 * - 使用 api 層的函式（api_trade.js）實際打後端
 * - 使用 DTO 轉換後端資料格式與前端資料格式
 * 
 * 命名規則：
 * - API 層使用 CRUD 動詞（get, create, update, delete）+ Api 後綴
 * - Service 層使用不同動詞（fetch, add, edit, remove）以區分層級
 *
 * 專案資料流：
 *   Component ➜ Service (本檔案) ➜ API (api_trade.js) ➜ request.js (axios instance)
 */

export const tradesService = {
  /**
   * 取得交易列表
   * @param {Object} params 查詢參數（page, pageSize, filters...）
   * @returns {Object|Array} 轉換後的交易列表資料
   */
  async fetchTrades(params = {}) {
    // 將前端的 pageSize 轉換為後端的 limit
    const apiParams = { ...params }
    if (apiParams.pageSize !== undefined) {
      apiParams.limit = apiParams.pageSize
      delete apiParams.pageSize
    }
    const apiResponse = await getTradesApi(apiParams)
    // 使用 DTO 轉換 API 資料為前端格式
    return tradeDTO.toFrontendList(apiResponse)
  },

  /**
   * 取得單筆交易
   * @param {string|number} tradeId 交易 ID
   * @returns {Object} 轉換後的交易資料
   */
  async fetchTrade(tradeId) {
    const apiResponse = await getTradeApi(tradeId)
    // 使用 DTO 轉換 API 資料為前端格式
    return tradeDTO.toFrontend(apiResponse)
  },

  /**
   * 新增交易
   * @param {Object} payload 交易資料（來自表單或前端模型）
   * @returns {Object} 轉換後的交易資料
   */
  async addTrade(payload) {
    // 使用 DTO 轉換前端資料為 API 格式
    const apiPayload = tradeDTO.toAPI(payload)
    const apiResponse = await createTradeApi(apiPayload)
    // 轉換回前端格式
    return tradeDTO.toFrontend(apiResponse)
  },

  /**
   * 更新交易（僅用於更新檢討相關欄位）
   * @param {string|number} tradeId 交易 ID
   * @param {Object} payload 要更新的欄位（只接受檢討相關欄位：reviewNotes, errorCategory, emotion, followedDiscipline, selfRating）
   * @returns {Object} 轉換後的交易資料
   */
  async editTrade(tradeId, payload) {
    const apiPayload = {}
    if (payload.reviewNotes !== undefined) apiPayload.reviewNotes = payload.reviewNotes
    if (payload.errorCategory !== undefined) apiPayload.errorCategory = payload.errorCategory
    if (payload.emotion !== undefined) apiPayload.emotion = payload.emotion
    if (payload.followedDiscipline !== undefined) {
      // 轉換 followedDiscipline：boolean -> 'yes'/'no'
      apiPayload.followedDiscipline = payload.followedDiscipline === true || payload.followedDiscipline === 'yes' ? 'yes' :
                                      payload.followedDiscipline === false || payload.followedDiscipline === 'no' ? 'no' :
                                      payload.followedDiscipline
    }
    if (payload.selfRating !== undefined) apiPayload.selfRating = payload.selfRating
    if (payload.strategyId !== undefined) apiPayload.strategyId = payload.strategyId

    const apiResponse = await updateTradeApi(tradeId, apiPayload)
    return tradeDTO.toFrontend(apiResponse)
  },

  /**
   * 刪除交易
   * @param {string|number} tradeId 交易 ID
   */
  async removeTrade(tradeId) {
    return await deleteTradeApi(tradeId)
  },
}

export default tradesService
