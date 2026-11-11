import RiskAlertService from '../services/RiskAlertService.js';

const riskController = {
  async getAlerts(req, res) {
    const data = await RiskAlertService.getAlerts(req.user.id);
    res.json({ success: true, data });
  },

  async ackAlert(req, res) {
    const { tradeId, alertType, priceDate } = req.body;
    const data = await RiskAlertService.acknowledge(req.user.id, {
      tradeId,
      alertType,
      priceDate,
    });
    res.json({ success: true, data });
  },

  async unackAlert(req, res) {
    // DELETE 帶 body 不是所有 client 都支援，這裡同時接受 body 與 query
    const { tradeId, alertType, priceDate } = { ...req.query, ...req.body };
    const data = await RiskAlertService.unacknowledge(req.user.id, {
      tradeId,
      alertType,
      priceDate,
    });
    res.json({ success: true, data });
  },

  async ackAll(req, res) {
    const data = await RiskAlertService.acknowledgeAll(req.user.id);
    res.json({ success: true, data });
  },
};

export default riskController;
