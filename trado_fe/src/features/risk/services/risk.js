import {
  getRiskAlertsApi,
  ackRiskAlertApi,
  unackRiskAlertApi,
  ackAllRiskAlertsApi,
} from '@api/api_risk';

export const EMPTY_SUMMARY = {
  openPositions: 0,
  total: 0,
  unacked: 0,
  breach: 0,
  near: 0,
  noStop: 0,
  invalidStop: 0,
  noPrice: 0,
};

export const riskService = {
  async fetchAlerts() {
    const data = await getRiskAlertsApi();
    return {
      asOf: data?.asOf || null,
      alerts: data?.alerts || [],
      summary: { ...EMPTY_SUMMARY, ...(data?.summary || {}) },
    };
  },

  acknowledge: (alert) =>
    ackRiskAlertApi({
      tradeId: alert.tradeId,
      alertType: alert.alertType,
      priceDate: alert.priceDate,
    }),

  unacknowledge: (alert) =>
    unackRiskAlertApi({
      tradeId: alert.tradeId,
      alertType: alert.alertType,
      priceDate: alert.priceDate,
    }),

  acknowledgeAll: () => ackAllRiskAlertsApi(),
};
