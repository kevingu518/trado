import {
  getTradeImportFieldsApi,
  suggestTradeMappingApi,
  previewTradeImportApi,
  commitTradeImportApi,
  getImportBatchesApi,
  getImportMappingsApi,
  getImportMappingApi,
} from '@api/api_tradeImport'

/**
 * Trade Import Service（TD-112 交易紀錄匯入）
 *
 * 專案資料流：
 *   Component ➜ Hook (useTradeImport) ➜ Service (本檔案) ➜ API (api_tradeImport.js)
 *
 * 這裡不放 DTO：後端匯入相關的回應本來就是 camelCase 且直接對應畫面需要的欄位
 * （headers / summary / rows / depositAmount…），沒有格式轉換要做。DTO 是給
 * 「後端格式 ≠ 前端格式」的模組用的（例如 trades 的 tradeDTO）。
 *
 * 命名規則：API 層用 CRUD 動詞 + Api 後綴，Service 層用 fetch / import 等動詞。
 */

/** 檔名去掉副檔名，作為「來源名稱」的預設值（例：2026Q3.csv → 2026Q3） */
export const defaultSourceName = (filename = '') => filename.replace(/\.[^.]+$/, '')

export const tradeImportService = {
  /**
   * 系統欄位定義。對應 UI 的欄位清單（label / required）由此而來，
   * 前端不寫死欄位，後端加欄位時前端自動跟著長出來。
   * @returns {{fields: Array, requiredFields: string[]}}
   */
  async fetchFields() {
    return await getTradeImportFieldsApi()
  },

  /**
   * 依表頭猜測欄位對應（「重新猜測」用）
   * 後端把結果包在 data.mapping 裡，這裡拆掉，呼叫端拿到的直接是對應表本身。
   * @param {string[]} headers
   * @returns {Object} { 系統欄位 key: 表頭名稱 }
   */
  async suggestMapping(headers) {
    const data = await suggestTradeMappingApi(headers)
    return data?.mapping ?? {}
  },

  /**
   * 解析 + 預覽，不寫入任何資料。
   * 不帶 mapping 時後端會自動套用猜測結果，前端靠這個拿到 headers 與建議對應
   * （表頭要解析後才知道，前端不該自己解檔）。
   * @param {{file: File, mapping?: Object}} params
   */
  async preview({ file, mapping }) {
    return await previewTradeImportApi({ file, filename: file?.name, mapping })
  },

  /**
   * 確認後寫入。mapping 必帶 —— 後端在寫入前一定要有一份明確的對應。
   * @param {{file: File, mapping: Object, sourceName?: string, saveMapping?: boolean}} params
   * @returns {Object} { batchId, depositAmount, savedMapping, tradeIds, summary }
   *   batchId 為 null 代表這批沒有新資料（全數重複），未寫入任何東西。
   */
  async importTrades({ file, mapping, sourceName, saveMapping = true }) {
    return await commitTradeImportApi({
      file,
      filename: file?.name,
      mapping,
      sourceName: sourceName || defaultSourceName(file?.name),
      saveMapping,
    })
  },

  /**
   * 這個來源先前存過的欄位對應，讓使用者不必重對一次。
   * @returns {Object|null} mapping，沒存過時為 null
   */
  async fetchSavedMapping(sourceName) {
    if (!sourceName) return null
    const saved = await getImportMappingApi(sourceName)
    return saved?.mapping ?? null
  },

  /** 所有已儲存的對應（來源名稱 → mapping） */
  async fetchMappings() {
    return await getImportMappingsApi()
  },

  /** 先前的匯入紀錄 */
  async fetchBatches(limit = 20) {
    return await getImportBatchesApi({ limit })
  },
}

export default tradeImportService
