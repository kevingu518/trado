import request from './request';
import { rawRequest } from './rawRequest';

/**
 * 交易相關 API
 * 使用 CRUD 動詞命名，並加上 Api 後綴以區分層級
 */

// Read - 取得交易列表
export const getTradesApi = (params = {}) => request.get('/trades', { params })

// Read - 取得每日進出倉位（依日期聚合）
export const getDailyPositionsApi = (params = {}) => request.get('/trades/daily-positions', { params })

// Read - 取得單筆交易
export const getTradeApi = (tradeId) => request.get(`/trades/${tradeId}`)

// Create - 新增交易
export const createTradeApi = (data) => request.post('/trades', data)

// Update - 更新交易
export const updateTradeApi = (tradeId, data) => request.put(`/trades/${tradeId}`, data)

// Delete - 刪除交易
export const deleteTradeApi = (tradeId) => request.delete(`/trades/${tradeId}`)

// Read - 匯出 CSV（套用與列表相同的 filter）
// 走原生 fetch：要讀 Content-Disposition 的檔名與 X-Row-Count（後端以
// exposedHeaders 曝光），axios 的攔截器只會回傳 data，header 拿不到。
export const exportTradesApi = async (params = {}) => {
  const res = await rawRequest('/trades/export', { query: params })

  // attachment; filename="trades-2026-09-29.csv"
  const disposition = res.headers.get('Content-Disposition') || ''
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] || 'trades.csv'

  return {
    blob: await res.blob(),
    filename,
    rowCount: Number(res.headers.get('X-Row-Count')) || 0,
  }
}

// ========== Position (倉位) 相關 API ==========

// Read - 取得交易的所有倉位
export const getPositionsApi = (tradeId, params = {}) => request.get(`/trades/${tradeId}/positions`, { params })

// Read - 取得單筆倉位
export const getPositionApi = (tradeId, positionId) => request.get(`/trades/${tradeId}/positions/${positionId}`)

// Create - 新增倉位
export const createPositionApi = (tradeId, data) => request.post(`/trades/${tradeId}/positions`, data)

// Update - 更新倉位
export const updatePositionApi = (tradeId, positionId, data) => request.put(`/trades/${tradeId}/positions/${positionId}`, data)

// Delete - 刪除倉位
export const deletePositionApi = (tradeId, positionId) => request.delete(`/trades/${tradeId}/positions/${positionId}`)
