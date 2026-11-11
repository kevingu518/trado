import { getDashboardApi } from '@api/api_dashboard';
import { transformDashboard } from './dashboardDTO';

export const dashboardService = {
  /**
   * 取得 Dashboard 所有資料（單一聚合 API）
   * @param {string} period    - 時段：month | q1 | q2 | q3 | q4 | year
   * @param {string} benchmark - 比較基準：TAIEX（加權指數）| 0050（元大台灣50）
   */
  async fetchDashboard(period, benchmark) {
    const data = await getDashboardApi({ period, benchmark });
    return transformDashboard(data);
  },
};
