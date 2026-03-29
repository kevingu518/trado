/**
 * 帳戶相關資料轉換服務
 */

/**
 * 轉換使用者資料格式
 */
export const transformUserData = (data) => {
  return {
    id: data.id || data.user_id,
    email: data.email || '',
    name: data.name || data.username || '',
    avatar: data.avatar || data.picture || '',
    loginType: data.login_type || data.loginType || 'email', // 'google' | 'email'
    googleId: data.google_id || data.googleId || null,
    googleAvatar: data.google_avatar || data.googleAvatar || null, // Google 原始頭像
    createdAt: data.created_at || data.createdAt || '',
    updatedAt: data.updated_at || data.updatedAt || '',
  };
};

/**
 * 轉換餘額資料格式
 */
export const transformBalanceData = (data) => {
  return {
    balance: data.balance || data.current_balance || 0,
    totalDeposit: data.total_deposit || data.totalDeposit || 0,
    totalWithdraw: data.total_withdraw || data.totalWithdraw || 0,
    availableBalance: data.available_balance || data.availableBalance || data.balance || 0,
  };
};

/**
 * 轉換資金變動記錄格式
 */
export const transformBalanceHistoryItem = (item) => {
  return {
    id: item.id || item.transaction_id,
    type: item.type || item.transaction_type, // 'deposit' | 'withdraw'
    amount: item.amount || 0,
    balance: item.balance || item.current_balance || 0,
    date: item.date || item.created_at || item.createdAt || '',
    method: item.method || item.payment_method || '',
    notes: item.notes || item.remark || '',
  };
};

/**
 * 轉換交易設定格式
 */
export const transformTradeSettings = (data) => {
  return {
    buyFeeRate: data.buy_fee_rate || data.buyFeeRate || 0.001425, // 0.1425%
    sellFeeRate: data.sell_fee_rate || data.sellFeeRate || 0.001425, // 0.1425%
    minFee: data.min_fee || data.minFee || 20, // 最低手續費 20 元
  };
};
