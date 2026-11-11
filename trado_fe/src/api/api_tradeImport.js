import { rawRequest, rawJson } from './rawRequest';

/**
 * 交易紀錄匯入 API（TD-112）
 *
 * 這幾條端點走原生 fetch（見 rawRequest.js 的說明）：
 * - preview / commit：body 直接是檔案本身，其餘中繼資料（filename / mapping /
 *   sourceName）走 query —— 與後端 routes/tradeImportRoutes.js 的約定一致。
 * - mapping 由 toQuery 自動序列化成 JSON 字串，不必在這裡手動 stringify。
 */

// Read - 系統欄位定義（欄位對應 UI 的來源：label / required / type）
export const getTradeImportFieldsApi = () => rawJson('/trade-import/fields')

// Read - 依表頭猜測欄位對應（body: { headers }）
export const suggestTradeMappingApi = (headers) =>
  rawJson('/trade-import/suggest-mapping', { method: 'POST', json: { headers } })

// Read - 解析 + 預覽，不寫入任何資料（不帶 mapping 時後端會自動套用猜測結果）
export const previewTradeImportApi = ({ file, filename, mapping }) =>
  rawJson('/trade-import/preview', {
    method: 'POST',
    body: file,
    query: { filename, mapping },
  })

// Create - 確認後寫入
export const commitTradeImportApi = ({ file, filename, mapping, sourceName, saveMapping }) =>
  rawJson('/trade-import/commit', {
    method: 'POST',
    body: file,
    query: { filename, mapping, sourceName, saveMapping },
  })

// Read - 先前的匯入紀錄（帶 total，外層另有分頁用的總筆數）
export const getImportBatchesApi = async ({ limit } = {}) => {
  const res = await rawRequest('/trade-import/batches', { query: { limit } })
  const body = await res.json()
  return { batches: body?.data ?? [], total: body?.total ?? 0 }
}

// Read - 已儲存的欄位對應（來源名稱清單）
export const getImportMappingsApi = () => rawJson('/trade-import/mappings')

// Read - 取單一來源已儲存的欄位對應；沒存過時後端回 data: null
export const getImportMappingApi = (sourceName) =>
  rawJson(`/trade-import/mappings/${encodeURIComponent(sourceName)}`)
