import {
  getRiskAlertsApi,
  getRiskExposureApi,
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

  /**
   * 曝險快照。空值一律保留 null——「算不出來」跟「等於 0」在風控上是兩件事，
   * 千萬不要在這裡補 0。
   */
  async fetchExposure() {
    const data = await getRiskExposureApi();
    return {
      asOf: data?.asOf || null,
      account: data?.account || null,
      exposure: data?.exposure || null,
      beta: data?.beta || null,
      concentration: data?.concentration || null,
      stopRisk: data?.stopRisk || null,
      sectors: data?.sectors || { categories: [], unclassified: null },
      positions: data?.positions || [],
      noStopPositions: data?.noStopPositions || [],
      suggestions: data?.suggestions || [],
      thresholds: data?.thresholds || {},
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
