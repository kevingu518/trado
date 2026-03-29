import { 
  getStrategiesApi, 
  getStrategyApi, 
  createStrategyApi, 
  updateStrategyApi, 
  deleteStrategyApi 
} from '@api/api_strategy'
import { strategyDTO } from './strategyDTO'

/**
 * Strategies Service
 * - 使用 api 層的函式（api_strategy.js）實際打後端
 * - 使用 DTO 轉換後端資料格式與前端資料格式
 * 
 * 命名規則：
 * - API 層使用 CRUD 動詞（get, create, update, delete）+ Api 後綴
 * - Service 層使用不同動詞（fetch, add, edit, remove）以區分層級
 *
 * 專案資料流：
 *   Component ➜ Service (本檔案) ➜ API (api_strategy.js) ➜ request.js (axios instance)
 */

export const strategiesService = {
  /**
   * 取得策略列表
   * @param {Object} params 查詢參數（page, pageSize, filters...）
   * @returns {Object} 轉換後的策略列表資料
   */
  async fetchStrategies(params = {}) {
    const apiResponse = await getStrategiesApi(params)
    // 使用 DTO 轉換 API 資料為前端格式
    return strategyDTO.toFrontendList(apiResponse)
  },

  /**
   * 取得單筆策略
   * @param {string|number} strategyId 策略 ID
   * @returns {Object} 轉換後的策略資料
   */
  async fetchStrategy(strategyId) {
    const apiResponse = await getStrategyApi(strategyId)
    // 使用 DTO 轉換 API 資料為前端格式
    return strategyDTO.toFrontend(apiResponse)
  },

  /**
   * 新增策略
   * @param {Object} payload 策略資料（來自表單或前端模型）
   * @returns {Object} 轉換後的策略資料
   */
  async addStrategy(payload) {
    // 使用 DTO 轉換前端資料為 API 格式
    const apiPayload = strategyDTO.toAPI(payload)
    const apiResponse = await createStrategyApi(apiPayload)
    // 轉換回前端格式
    return strategyDTO.toFrontend(apiResponse)
  },

  /**
   * 更新策略
   * @param {string|number} strategyId 策略 ID
   * @param {Object} payload 要更新的欄位
   * @returns {Object} 轉換後的策略資料
   */
  async editStrategy(strategyId, payload) {
    // 使用 DTO 轉換前端資料為 API 格式
    const apiPayload = strategyDTO.toAPI(payload)
    const apiResponse = await updateStrategyApi(strategyId, apiPayload)
    // 轉換回前端格式
    return strategyDTO.toFrontend(apiResponse)
  },

  /**
   * 刪除策略
   * @param {string|number} strategyId 策略 ID
   */
  async removeStrategy(strategyId) {
    return await deleteStrategyApi(strategyId)
  },
}

export default strategiesService
