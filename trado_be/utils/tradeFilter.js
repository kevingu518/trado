/**
 * Trade 清單與匯出共用的篩選條件。
 *
 * 抽出來的理由：匯出鈕是「套用當前 filter」，同一組 query 參數必須產生同一組條件。
 * 兩份實作只要有一邊走樣，使用者看到的清單和他拿到的檔案就會不一致，
 * 而且不會有任何錯誤訊息。
 */

/** 只有日期 → 當天 00:00:00.000Z；已帶時間的字串則直接採用 */
const toRangeStart = (value) =>
  typeof value === 'string' && value.includes('T')
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);

/** 只有日期 → 當天 23:59:59.999Z（含整個結束日） */
const toRangeEnd = (value) =>
  typeof value === 'string' && value.includes('T')
    ? new Date(value)
    : new Date(`${value}T23:59:59.999Z`);

/**
 * @param {string} userId
 * @param {{status?: string, symbol?: string, direction?: string, startDate?: string, endDate?: string, strategy?: string}} options
 */
export function buildTradeWhere(userId, options = {}) {
  const { status, symbol, direction, startDate, endDate, strategy } = options;

  const createdAt = {};
  if (startDate) createdAt.gte = toRangeStart(startDate);
  if (endDate) createdAt.lte = toRangeEnd(endDate);

  return {
    userId,
    ...(status && { status }),
    ...(symbol && { symbol }),
    ...(direction && ['long', 'short'].includes(direction) && { direction }),
    ...(Object.keys(createdAt).length > 0 && { createdAt }),
    // 策略篩選：同時涵蓋 Trade.strategyId（直接綁定）與 TradeStrategy 關聯表
    ...(strategy && {
      OR: [
        { strategyId: strategy },
        { strategies: { some: { strategyId: strategy } } },
      ],
    }),
  };
}

const VALID_SORT_FIELDS = ['createdAt', 'updatedAt', 'closedAt', 'symbol', 'status'];

export function buildTradeOrderBy(sortBy, sortOrder) {
  const field = VALID_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
  const order = String(sortOrder ?? '').toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { [field]: order };
}
