import AnalysisService from '../services/AnalysisService.js';
import { DEFAULT_BENCHMARK, isBenchmark } from '../utils/benchmarks.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 只收 YYYY-MM-DD；空字串 / 亂七八糟的字串一律當沒給，
// 讓 service 自己決定預設區間（帳號第一筆活動 ~ 今天）
const cleanDate = (v) => (typeof v === 'string' && DATE_RE.test(v) ? v : undefined);

const analysisController = {
  async getTearsheet(req, res) {
    const { from, to, benchmark } = req.query;
    // 白名單過濾，避免任意字串被帶進查價
    const bench = isBenchmark(benchmark) ? benchmark : DEFAULT_BENCHMARK;
    const data = await AnalysisService.getTearsheet(req.user.id, {
      from: cleanDate(from),
      to: cleanDate(to),
      benchmark: bench,
    });
    res.json({ success: true, data });
  },
};

export default analysisController;
