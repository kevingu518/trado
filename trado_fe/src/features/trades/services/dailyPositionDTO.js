/**
 * Daily Position DTO
 * 後端 /trades/daily-positions 回應 → 前端格式
 */

export const dailyPositionDTO = {
  toAdjustment(adj) {
    const shares = adj.shares || 0
    const price = parseFloat(adj.price) || 0
    return {
      key: adj.id,
      id: adj.id,
      tradeId: adj.tradeId,
      timestamp: adj.timestamp,
      action: adj.action,
      shares,
      price,
      amount: shares * price,
      fee: adj.fee || 0,
      tax: adj.tax || 0,
      isDayTrade: !!adj.isDayTrade,
      stopLoss: adj.stopLoss != null ? parseFloat(adj.stopLoss) : null,
      note: adj.note || '',
      symbol: adj.trade?.symbol || '',
      direction: adj.trade?.direction || '',
      strategyName: adj.trade?.strategy?.name || null,
      strategyId: adj.trade?.strategy?.id || null,
      _raw: adj,
    }
  },

  toFrontend(apiDay) {
    if (!apiDay) return null
    return {
      key: apiDay.date,
      date: apiDay.date,
      totalCount: Number(apiDay.totalCount) || 0,
      buyCount: Number(apiDay.buyCount) || 0,
      sellCount: Number(apiDay.sellCount) || 0,
      buyAmount: Number(apiDay.buyAmount) || 0,
      sellAmount: Number(apiDay.sellAmount) || 0,
      totalFee: Number(apiDay.totalFee) || 0,
      totalTax: Number(apiDay.totalTax) || 0,
      netCashFlow: Number(apiDay.netCashFlow) || 0,
      symbols: Array.isArray(apiDay.symbols) ? apiDay.symbols : [],
      adjustments: (apiDay.adjustments || []).map(a => this.toAdjustment(a)),
      _raw: apiDay,
    }
  },

  toFrontendList(apiData) {
    if (!apiData) return { list: [], total: 0, page: 1, pageSize: 30 }
    const days = Array.isArray(apiData) ? apiData : (apiData.data || apiData.days || [])
    const pg = apiData.pagination || {}
    return {
      list: days.map(d => this.toFrontend(d)),
      total: pg.total ?? days.length,
      page: pg.page ?? 1,
      pageSize: pg.limit ?? 30,
    }
  },
}

export default dailyPositionDTO
