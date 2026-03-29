import request from './request';

/**
 * 策略相關 API
 * 使用 CRUD 動詞命名，並加上 Api 後綴以區分層級
 */

// Read - 取得策略列表
export const getStrategiesApi = (params = {}) => request.get('/strategies', { params })

// Read - 取得單筆策略
export const getStrategyApi = (strategyId) => request.get(`/strategies/${strategyId}`)

// Create - 新增策略
export const createStrategyApi = (data) => request.post('/strategies', data)

// Update - 更新策略
export const updateStrategyApi = (strategyId, data) => request.put(`/strategies/${strategyId}`, data)

// Delete - 刪除策略
export const deleteStrategyApi = (strategyId) => request.delete(`/strategies/${strategyId}`)
