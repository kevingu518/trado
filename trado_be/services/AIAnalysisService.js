import prisma from '../config/database.js';
import { AppError } from '../errors/index.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { AI_PROVIDERS, getProviderConfig, streamChat, pingProvider, TYPICAL_USAGE } from './ai/llm.js';

// ── 枚舉中文映射 ──────────────────────────────────────
const EMOTION_LABELS = {
  CALM: '冷靜', ANXIOUS: '焦慮', EXCITED: '興奮', FEARFUL: '恐懼', GREEDY: '貪婪',
  CONFIDENT: '自信', DOUBTFUL: '猶豫', FRUSTRATED: '挫折', IMPATIENT: '急躁', NEUTRAL: '中性',
};
const ERROR_LABELS = {
  ENTRY_TIMING: '進場時機錯誤', EXIT_TIMING: '出場時機錯誤', POSITION_SIZE: '部位大小錯誤',
  EMOTION_CONTROL: '情緒控制問題', STRATEGY_DEVIATION: '偏離策略', RISK_MANAGEMENT: '風險管理問題',
  MARKET_ANALYSIS: '市場分析錯誤', OTHER: '其他',
};

const PERIOD_DAYS = { month: 30, '3months': 90 };
const DEFAULT_PROVIDER = 'anthropic';

const SYSTEM_PROMPT = `你是一位專業的交易教練。使用者會提供一段期間的交易資料（JSON），其中 summary 內含「後端已經精算好的統計數字」：整體績效、行為分數（behaviorScores）、確定性偵測器（detectors）、情緒分布、紀律與自評校準等。

【最重要的規則】
- summary 裡的所有數字都是後端算好的。你只能「引用與解讀」，**絕對不可以自己重新計算、估算或發明任何數字**（勝率、損益、百分比、金額一律以 summary 為準，直接引用）。
- trades 明細只供你理解個別情境（例如讀 reviewNotes 了解當下想法），**不要拿它自行加總或統計**。
- 若某項數據為 null 或樣本太小，誠實說「資料不足」，不要硬湊結論。

【輸出結構】（繁體中文、Markdown、標題用 ##）
1. **行為總評**：先呈現三個行為分數（情緒控制／風險管理／紀律遵守，0–100），各配一句話。null 就說資料不足。提醒這是啟發式指標、非精確值。
2. **關鍵發現**：把 detectors 由影響（金額）大到小逐條列出，每條講清楚代價金額與信心；信心為 low（樣本小）的要註明「樣本偏少，僅供參考」。
3. **行為 vs 績效**：解讀「遵守紀律 vs 沒遵守」、情緒分布、自評校準（selfRatingCalibration）與損益的關係——這是最有價值的部分。
4. **具體建議**：3~5 條，針對上面的發現，可執行、不講通用空話。

語氣像教練：直接、誠實、對事不對人，好習慣也要肯定。`;

class AIAnalysisService {
  // ── 設定 CRUD ─────────────────────────────────────────

  async getSettings(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true, aiModel: true, aiApiKey: true },
    });

    const provider = user?.aiProvider || DEFAULT_PROVIDER;
    const cfg = AI_PROVIDERS[provider] || AI_PROVIDERS[DEFAULT_PROVIDER];

    let keyMask = null;
    if (user?.aiApiKey) {
      try {
        const plain = decrypt(user.aiApiKey);
        keyMask = `····${plain.slice(-4)}`;
      } catch {
        keyMask = '····????'; // 解密失敗（例如 ENCRYPTION_KEY 換過），仍視為已設定
      }
    }

    return {
      provider,
      model: user?.aiModel || cfg.defaultModel,
      hasKey: Boolean(user?.aiApiKey),
      keyMask,
      providers: Object.entries(AI_PROVIDERS).map(([value, c]) => ({
        value,
        label: c.label,
        defaultModel: c.defaultModel,
        stable: Boolean(c.stable),
        pricing: c.pricing,
        docsUrl: c.docsUrl,
        // 單次分析的概略費用（美金）= 概略 token 量 × 單價
        estPerRunUSD: Number(
          (
            (TYPICAL_USAGE.inputTokens / 1e6) * c.pricing.input +
            (TYPICAL_USAGE.outputTokens / 1e6) * c.pricing.output
          ).toFixed(4)
        ),
      })),
    };
  }

  async updateSettings(userId, { provider, model, apiKey }) {
    if (provider != null) getProviderConfig(provider); // 驗證供應商有效

    const data = {};
    if (provider != null) data.aiProvider = provider;
    if (model !== undefined) data.aiModel = model ? String(model).trim() : null;

    // apiKey: 非空字串 → 加密儲存；空字串 → 清除；undefined → 不動
    if (apiKey !== undefined) {
      const trimmed = String(apiKey).trim();
      data.aiApiKey = trimmed ? encrypt(trimmed) : null;
    }

    await prisma.user.update({ where: { id: userId }, data });
    return this.getSettings(userId);
  }

  async clearSettings(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiApiKey: null },
    });
    return this.getSettings(userId);
  }

  /**
   * 測試連線。優先用傳入的 apiKey（存檔前先測），否則用已存的金鑰。
   */
  async testConnection(userId, { provider, model, apiKey } = {}) {
    let useProvider = provider;
    let useModel = model;
    let useKey = apiKey ? String(apiKey).trim() : null;

    if (!useProvider || !useKey) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiProvider: true, aiModel: true, aiApiKey: true },
      });
      useProvider = useProvider || user?.aiProvider || DEFAULT_PROVIDER;
      if (useModel === undefined || useModel === null || useModel === '') useModel = user?.aiModel || null;
      if (!useKey) {
        if (!user?.aiApiKey) throw new AppError('尚未設定 API key，無法測試連線', 400);
        useKey = decrypt(user.aiApiKey);
      }
    }

    const cfg = getProviderConfig(useProvider);
    const resolvedModel = (useModel && useModel.trim()) || cfg.defaultModel;

    const start = Date.now();
    try {
      await pingProvider({ provider: useProvider, apiKey: useKey, model: resolvedModel });
    } catch (err) {
      throw new AppError(`連線測試失敗：${err.message}`, 400);
    }
    return { ok: true, provider: useProvider, model: resolvedModel, latencyMs: Date.now() - start };
  }

  // ── 分析資料組裝 ───────────────────────────────────────

  async buildContext(userId, period) {
    const days = PERIOD_DAYS[period] || PERIOD_DAYS.month;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const trades = await prisma.trade.findMany({
      where: { userId, status: 'closed', closedAt: { gte: startDate, lte: endDate } },
      select: {
        symbol: true, direction: true, netProfitLoss: true, profitLossRatio: true,
        holdingDuration: true, entryCount: true, closedAt: true,
        emotion: true, errorCategory: true, followedDiscipline: true,
        selfRating: true, reviewNotes: true,
      },
      orderBy: { closedAt: 'asc' },
    });

    const tradeRows = trades.map((t) => ({
      symbol: t.symbol,
      direction: t.direction,
      netPnL: t.netProfitLoss ?? 0,
      pnlRatio: t.profitLossRatio != null ? Number(t.profitLossRatio) : null,
      holdingDays: t.holdingDuration != null ? Number(t.holdingDuration) : null,
      entryCount: t.entryCount ?? null,
      closedAt: t.closedAt ? t.closedAt.toISOString().slice(0, 10) : null,
      emotion: t.emotion ? (EMOTION_LABELS[t.emotion] || t.emotion) : null,
      errorCategory: t.errorCategory ? (ERROR_LABELS[t.errorCategory] || t.errorCategory) : null,
      followedDiscipline: t.followedDiscipline || null,
      selfRating: t.selfRating ?? null,
      reviewNotes: t.reviewNotes || null,
    }));

    return {
      period: period === '3months' ? '近三個月' : '近一個月',
      dateRange: { from: startDate.toISOString().slice(0, 10), to: endDate.toISOString().slice(0, 10) },
      summary: this._summarize(tradeRows),
      trades: tradeRows,
    };
  }

  _summarize(rows) {
    const n = rows.length;
    if (n === 0) return { tradeCount: 0 };

    const pnls = rows.map((r) => r.netPnL);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const totalNet = pnls.reduce((a, b) => a + b, 0);
    const winRate = Number(((wins.length / n) * 100).toFixed(1));
    const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    const rrRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : null;

    const byFlag = (pred) => {
      const sub = rows.filter(pred);
      if (!sub.length) return null;
      const w = sub.filter((r) => r.netPnL > 0).length;
      return {
        count: sub.length,
        winRate: Number(((w / sub.length) * 100).toFixed(1)),
        totalNet: sub.reduce((a, r) => a + r.netPnL, 0),
      };
    };

    const disciplineFollowed = byFlag((r) => r.followedDiscipline === 'yes');
    const disciplineBroken = byFlag((r) => r.followedDiscipline === 'no');

    // 情緒 → 損益（含負面情緒判定）
    const NEGATIVE_EMOTIONS = new Set(['焦慮', '恐懼', '貪婪', '挫折', '急躁', '猶豫']);
    const emotionStats = {};
    for (const r of rows) {
      if (!r.emotion) continue;
      (emotionStats[r.emotion] ||= []).push(r.netPnL);
    }
    const emotionBreakdown = Object.entries(emotionStats)
      .map(([emotion, arr]) => ({
        emotion,
        count: arr.length,
        totalNet: arr.reduce((a, b) => a + b, 0),
        avgNet: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
        winRate: Number(((arr.filter((p) => p > 0).length / arr.length) * 100).toFixed(1)),
      }))
      .sort((a, b) => a.totalNet - b.totalNet);

    const emotionTagged = emotionBreakdown.reduce((a, e) => a + e.count, 0);
    const negativeTagged = emotionBreakdown
      .filter((e) => NEGATIVE_EMOTIONS.has(e.emotion))
      .reduce((a, e) => a + e.count, 0);

    // 自評校準：高分（>=7）vs 低分（<=4）的實際勝率
    const ratings = rows.filter((r) => r.selfRating != null);
    const ratedWinRate = (sub) =>
      sub.length ? Number(((sub.filter((r) => r.netPnL > 0).length / sub.length) * 100).toFixed(1)) : null;
    const highRated = ratings.filter((r) => r.selfRating >= 7);
    const lowRated = ratings.filter((r) => r.selfRating <= 4);
    const selfRatingCalibration = ratings.length
      ? {
          highCount: highRated.length,
          highWinRate: ratedWinRate(highRated),
          lowCount: lowRated.length,
          lowWinRate: ratedWinRate(lowRated),
        }
      : null;

    // ── 行為分數（0–100，啟發式指標）─────────────────────
    const reviewed = (disciplineFollowed?.count || 0) + (disciplineBroken?.count || 0);
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
    const behaviorScores = {
      emotionalControl: emotionTagged
        ? { score: clamp((1 - negativeTagged / emotionTagged) * 100), basis: `負面情緒占比 ${negativeTagged}/${emotionTagged}` }
        : null,
      riskManagement:
        avgLoss > 0
          ? { score: clamp((rrRatio / 2) * 100), basis: `盈虧比 ${rrRatio}（=平均獲利/平均虧損）` }
          : wins.length
            ? { score: 90, basis: '此期間沒有虧損交易（樣本可能偏少）' }
            : null,
      strategyAdherence: reviewed
        ? { score: clamp((disciplineFollowed?.count || 0) / reviewed * 100), basis: `遵守紀律 ${disciplineFollowed?.count || 0}/${reviewed} 筆` }
        : null,
    };

    // ── 確定性偵測器（依金額影響排序）────────────────────
    const detectors = [];

    if (disciplineBroken && disciplineBroken.totalNet < 0) {
      detectors.push({
        key: 'discipline_cost',
        title: '破壞紀律的代價',
        costNet: disciplineBroken.totalNet,
        sample: disciplineBroken.count,
        detail: `未遵守紀律的 ${disciplineBroken.count} 筆合計 ${disciplineBroken.totalNet} 元（勝率 ${disciplineBroken.winRate}%）`,
        confidence: disciplineBroken.count >= 5 ? 'medium' : 'low',
      });
    }

    const worstEmotion = emotionBreakdown.find((e) => e.totalNet < 0);
    if (worstEmotion) {
      detectors.push({
        key: 'emotion_cost',
        title: `「${worstEmotion.emotion}」情緒的代價`,
        costNet: worstEmotion.totalNet,
        sample: worstEmotion.count,
        detail: `標記為${worstEmotion.emotion}的 ${worstEmotion.count} 筆合計 ${worstEmotion.totalNet} 元（勝率 ${worstEmotion.winRate}%）`,
        confidence: worstEmotion.count >= 5 ? 'medium' : 'low',
      });
    }

    // 虧損集中：單一標的占總虧損比重
    const lossBySymbol = {};
    for (const r of rows) {
      if (r.netPnL < 0) lossBySymbol[r.symbol] = (lossBySymbol[r.symbol] || 0) + r.netPnL;
    }
    const totalLoss = Object.values(lossBySymbol).reduce((a, b) => a + b, 0);
    const topLoss = Object.entries(lossBySymbol).sort((a, b) => a[1] - b[1])[0];
    if (topLoss && totalLoss < 0) {
      const share = Math.round((topLoss[1] / totalLoss) * 100);
      if (share >= 40) {
        detectors.push({
          key: 'loss_concentration',
          title: '虧損過度集中',
          costNet: topLoss[1],
          sample: rows.filter((r) => r.symbol === topLoss[0] && r.netPnL < 0).length,
          detail: `${topLoss[0]} 占本期總虧損的 ${share}%`,
          confidence: 'medium',
        });
      }
    }

    // 自評過度自信：高分單勝率反而低於整體
    if (highRated.length >= 3 && selfRatingCalibration.highWinRate < winRate) {
      detectors.push({
        key: 'overconfidence',
        title: '高自評單表現不如預期',
        costNet: null,
        sample: highRated.length,
        detail: `自評 ≥7 的 ${highRated.length} 筆勝率 ${selfRatingCalibration.highWinRate}%，低於整體 ${winRate}%`,
        confidence: highRated.length >= 5 ? 'medium' : 'low',
      });
    }

    detectors.sort((a, b) => (a.costNet ?? 0) - (b.costNet ?? 0));

    return {
      tradeCount: n,
      winRate,
      totalNet,
      avgWin: Math.round(avgWin),
      avgLoss: Math.round(avgLoss),
      rrRatio,
      avgHoldingDays: Number((rows.reduce((a, r) => a + (r.holdingDays || 0), 0) / n).toFixed(1)),
      behaviorScores,
      detectors,
      disciplineFollowed,
      disciplineBroken,
      avgSelfRating: ratings.length
        ? Number((ratings.reduce((a, r) => a + r.selfRating, 0) / ratings.length).toFixed(1))
        : null,
      selfRatingCalibration,
      emotionBreakdown,
    };
  }

  // ── 分析執行 ───────────────────────────────────────────

  /**
   * 串流前置驗證：取設定、解密金鑰、組 context。任何問題會 throw（讓 controller 回 JSON 錯誤）。
   */
  async prepareAnalyze(userId, period) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true, aiModel: true, aiApiKey: true },
    });

    if (!user?.aiApiKey) {
      throw new AppError('尚未設定 AI API key，請先到「AI 設定」填入金鑰', 400);
    }

    const provider = user.aiProvider || DEFAULT_PROVIDER;
    const cfg = getProviderConfig(provider);
    const model = user.aiModel || cfg.defaultModel;

    let apiKey;
    try {
      apiKey = decrypt(user.aiApiKey);
    } catch {
      throw new AppError('AI API key 解密失敗，請重新設定金鑰', 400);
    }

    const context = await this.buildContext(userId, period);
    if (!context.summary || context.summary.tradeCount === 0) {
      throw new AppError(`${context.period}沒有已平倉交易，無法分析`, 400);
    }

    return { provider, model, apiKey, context };
  }

  /**
   * 串流分析結果（純文字 chunk）。前置驗證請先呼叫 prepareAnalyze。
   */
  async *streamAnalyze({ provider, model, apiKey, context }) {
    const user = `以下是我的交易資料（JSON）：\n\n${JSON.stringify(context, null, 2)}\n\n請依系統指示分析。`;
    yield* streamChat({ provider, apiKey, model, system: SYSTEM_PROMPT, user });
  }
}

export default new AIAnalysisService();
