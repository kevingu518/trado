import DashboardService from '../services/DashboardService.js';
import { DEFAULT_BENCHMARK, isBenchmark } from '../utils/benchmarks.js';

const dashboardController = {
  async getDashboard(req, res) {
    const { period = 'month', benchmark } = req.query;
    // 只接受白名單裡的基準，避免把任意字串帶進查價
    const bench = isBenchmark(benchmark) ? benchmark : DEFAULT_BENCHMARK;
    const data = await DashboardService.getDashboardData(req.user.id, period, bench);
    res.json({ success: true, data });
  },
};

export default dashboardController;
