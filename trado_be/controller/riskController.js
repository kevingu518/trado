import RiskAlertService from '../services/RiskAlertService.js';
import RiskExposureService from '../services/RiskExposureService.js';

const riskController = {
  async getAlerts(req, res) {
    const data = await RiskAlertService.getAlerts(req.user.id);
    res.json({ success: true, data });
  },

  async getExposure(req, res) {
    // accountId 先收下，多帳號（TD-113）接上後才會有值
    const data = await RiskExposureService.getExposure(req.user.id, {
      accountId: req.query.accountId || null,
    });
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
