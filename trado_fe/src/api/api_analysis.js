import request from './request';

/**
 * 分析頁 API
 * 單一端點回傳整份 tearsheet（指標 + 曲線 + 月報酬 + 滾動指標），
 * 避免前端為了同一段序列打好幾次 request。
 */
export const getTearsheetApi = (params = {}) =>
  request.get('/analysis/tearsheet', { params });
