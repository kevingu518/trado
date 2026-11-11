import { getTearsheetApi } from '@api/api_analysis';
import { transformTearsheet } from './analysisDTO';

export const analysisService = {
  /**
   * 取得績效分析（tearsheet）
   * @param {object} params
   * @param {string} [params.from]      YYYY-MM-DD，未給則從帳號第一筆活動起
   * @param {string} [params.to]        YYYY-MM-DD
   * @param {string} [params.benchmark] TAIEX | 0050
   */
  async fetchTearsheet({ from, to, benchmark } = {}) {
    const data = await getTearsheetApi({ from, to, benchmark });
    return transformTearsheet(data);
  },
};
