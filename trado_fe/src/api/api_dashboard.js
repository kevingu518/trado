import request from './request';

/**
 * Dashboard API
 * 單一聚合端點，一次取得所有 Dashboard 資料
 */
export const getDashboardApi = (params = {}) => request.get('/dashboard', { params });
