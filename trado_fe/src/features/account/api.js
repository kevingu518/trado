import request from '@/api/request';

export const accountAPI = {
  // ========== 個人資料相關 ==========
  // 取得當前使用者資料
  getProfile: () => 
    request.get('/account/profile'),
  
  // 更新使用者資料
  updateProfile: (data) => 
    request.put('/account/profile', data),
  
  // 上傳頭像
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request.upload('/account/avatar', formData);
  },

  // 恢復 Google 頭像
  restoreGoogleAvatar: () => 
    request.post('/account/avatar/restore-google'),

  // ========== 資金管理相關 ==========
  // 取得帳戶餘額
  getBalance: () => 
    request.get('/account/balance'),
  
  // 取得資金變動記錄
  getBalanceHistory: (params = {}) => 
    request.get('/account/balance/history', { params }),
  
  // 入金
  deposit: (data) => 
    request.post('/account/deposit', data),
  
  // 出金
  withdraw: (data) =>
    request.post('/account/withdraw', data),

  // 設定現金餘額
  setCashBalance: (data) =>
    request.put('/account/cash-balance', data),

  // ========== 交易設定相關 ==========
  // 取得交易設定
  getTradeSettings: () => 
    request.get('/account/trade-settings'),
  
  // 更新交易設定
  updateTradeSettings: (data) => 
    request.put('/account/trade-settings', data),
};
