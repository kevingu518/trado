import request from './request'

/**
 * 取個股 K 線（後端代理，自動處理上市/上櫃）
 * @param {string} symbol  e.g. "2330" / "6488"
 * @param {string} start   YYYY-MM-DD
 * @param {string} end     YYYY-MM-DD
 * @returns {Promise<{ symbol, source, rows: Array<{date, open, high, low, close, volume, source}> }>}
 */
export const getStockKlineApi = (symbol, start, end) =>
  request.get(`/stocks/${symbol}/kline`, { params: { start, end } })

/**
 * 取多個 symbol 的最新收盤價（不會觸發外部 API）
 * @param {string[]} symbols
 * @returns {Promise<Object>} { [symbol]: { date, close, source } | null }
 */
export const getStockLatestPricesApi = (symbols) => {
  if (!Array.isArray(symbols) || symbols.length === 0) return Promise.resolve({})
  return request.get('/stocks/prices', { params: { symbols: symbols.join(',') } })
}
