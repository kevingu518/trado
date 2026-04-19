/**
 * 台股手續費與證交稅計算工具
 *
 * 手續費：成交金額 × 0.1425% × 折扣率，最低 20 元（買賣皆收）
 * 證交稅：成交金額 × 0.3%（僅賣出時收取，當沖減半 0.15%）
 */

const FEE_RATE = 0.001425; // 0.1425%
const MIN_FEE = 20;
const TAX_RATE = 0.003; // 0.3%
const DAY_TRADE_TAX_RATE = 0.0015; // 0.15%

/**
 * 計算手續費
 * @param {number} shares - 股數
 * @param {number} price - 每股價格
 * @param {number} discount - 折扣率（0~1，例如 0.6 = 六折），預設 1.0（不折扣）
 * @returns {number} 手續費（整數，TWD）
 */
export function calculateFee(shares, price, discount = 1.0) {
  const gross = shares * Number(price);
  const fee = Math.round(gross * FEE_RATE * discount);
  return Math.max(MIN_FEE, fee);
}

/**
 * 計算證交稅（僅賣出時收取）
 * @param {number} shares - 股數
 * @param {number} price - 每股價格
 * @param {boolean} isDayTrade - 是否為當沖交易
 * @returns {number} 證交稅（整數，TWD）
 */
export function calculateTax(shares, price, isDayTrade = false) {
  const gross = shares * Number(price);
  const rate = isDayTrade ? DAY_TRADE_TAX_RATE : TAX_RATE;
  return Math.round(gross * rate);
}

export { FEE_RATE, MIN_FEE, TAX_RATE, DAY_TRADE_TAX_RATE };
