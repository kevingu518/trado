import request from './request';

/**
 * 風險中心 API
 * 警示是「每天收盤後算一次」的結果，不是即時報價。
 */
export const getRiskAlertsApi = () => request.get('/risk/alerts');

export const ackRiskAlertApi = ({ tradeId, alertType, priceDate }) =>
  request.post('/risk/alerts/ack', { tradeId, alertType, priceDate });

// DELETE 的參數用 query 傳，避免部分代理／瀏覽器吃掉 body
export const unackRiskAlertApi = ({ tradeId, alertType, priceDate }) =>
  request.delete('/risk/alerts/ack', { params: { tradeId, alertType, priceDate } });

export const ackAllRiskAlertsApi = () => request.post('/risk/alerts/ack-all');
