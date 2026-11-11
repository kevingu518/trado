import AIAnalysisService from '../services/AIAnalysisService.js';

const aiAnalysisController = {
  async getSettings(req, res) {
    const data = await AIAnalysisService.getSettings(req.user.id);
    res.json({ success: true, data });
  },

  async updateSettings(req, res) {
    const { provider, model, api_key } = req.body;
    const data = await AIAnalysisService.updateSettings(req.user.id, {
      provider,
      model,
      apiKey: api_key,
    });
    res.json({ success: true, data });
  },

  async clearSettings(req, res) {
    const data = await AIAnalysisService.clearSettings(req.user.id);
    res.json({ success: true, data });
  },

  async test(req, res) {
    const { provider, model, api_key } = req.body;
    const data = await AIAnalysisService.testConnection(req.user.id, {
      provider,
      model,
      apiKey: api_key,
    });
    res.json({ success: true, data });
  },

  // 串流分析。前置驗證若失敗會 throw → asyncHandler 交給 errorHandler 回 JSON（此時尚未送出 header）。
  // 一旦開始寫入串流，後續錯誤改寫入訊息並結束，不再丟回 asyncHandler。
  async analyze(req, res) {
    const { period } = req.body;
    const prepared = await AIAnalysisService.prepareAnalyze(req.user.id, period);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // 避免反向代理緩衝

    try {
      for await (const chunk of AIAnalysisService.streamAnalyze(prepared)) {
        res.write(chunk);
      }
    } catch (err) {
      console.error('AI analyze stream error:', err.message);
      res.write(`\n\n⚠️ 分析過程發生錯誤：${err.message}`);
    } finally {
      res.end();
    }
  },
};

export default aiAnalysisController;
