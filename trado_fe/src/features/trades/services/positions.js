// src/features/trades/services/positions.js
import {
  getPositionsApi,
  getPositionApi,
  createPositionApi,
  updatePositionApi,
  deletePositionApi,
} from '@api/api_trade'
import { positionDTO } from './positionDTO'

/**
 * Positions Service
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

export const positionsService = {
  /**
   * 取得交易的所有倉位
   * @param {string|number} tradeId 交易 ID
   * @param {Object} params 查詢參數（page, pageSize, filters...）
   * @returns {Object|Array} 轉換後的倉位列表資料
   */
  async fetchPositions(tradeId, params = {}) {
    const apiResponse = await getPositionsApi(tradeId, params)
    // 使用 DTO 轉換 API 資料為前端格式
    return positionDTO.toFrontendList(apiResponse)
  },

  /**
   * 取得單筆倉位
   * @param {string|number} tradeId 交易 ID
   * @param {string|number} positionId 倉位 ID
   * @returns {Object} 轉換後的倉位資料
   */
  async fetchPosition(tradeId, positionId) {
    const apiResponse = await getPositionApi(tradeId, positionId)
    // 使用 DTO 轉換 API 資料為前端格式
    return positionDTO.toFrontend(apiResponse)
  },

  /**
   * 新增倉位
   * @param {string|number} tradeId 交易 ID
   * @param {Object} payload 倉位資料（來自表單或前端模型）
   * @returns {Object} 轉換後的倉位資料
   */
  async addPosition(tradeId, payload) {
    // 使用 DTO 轉換前端資料為 API 格式
    const apiPayload = positionDTO.toAPI(payload)
    const apiResponse = await createPositionApi(tradeId, apiPayload)
    // 轉換回前端格式
    return positionDTO.toFrontend(apiResponse)
  },

  /**
   * 更新倉位
   * @param {string|number} tradeId 交易 ID
   * @param {string|number} positionId 倉位 ID
   * @param {Object} payload 要更新的欄位
   * @returns {Object} 轉換後的倉位資料
   */
  async editPosition(tradeId, positionId, payload) {
    // 使用 DTO 轉換前端資料為 API 格式
    const apiPayload = positionDTO.toAPI(payload)
    const apiResponse = await updatePositionApi(tradeId, positionId, apiPayload)
    // 轉換回前端格式
    return positionDTO.toFrontend(apiResponse)
  },

  /**
   * 刪除倉位
   * @param {string|number} tradeId 交易 ID
   * @param {string|number} positionId 倉位 ID
   */
  async removePosition(tradeId, positionId) {
    return await deletePositionApi(tradeId, positionId)
  },
}

export default positionsService
