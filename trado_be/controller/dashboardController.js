import DashboardService from '../services/DashboardService.js';

const dashboardController = {
  async getDashboard(req, res) {
    const { period = 'month' } = req.query;
    const data = await DashboardService.getDashboardData(req.user.id, period);
    res.json({ success: true, data });
  },
};

export default dashboardController;
