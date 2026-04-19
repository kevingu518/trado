import { getDashboardApi } from '@api/api_dashboard';
import { transformDashboard } from './dashboardDTO';

export const dashboardService = {
  /**
   * 取得 Dashboard 所有資料（單一聚合 API）
   * @param {string} period - 時段：month | q1 | q2 | q3 | q4 | year
   */
  async fetchDashboard(period) {
    const data = await getDashboardApi({ period });
    return transformDashboard(data);
  },
};
