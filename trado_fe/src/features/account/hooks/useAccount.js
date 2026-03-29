import { useState, useEffect } from 'react';
import { message } from 'antd';
import { accountAPI } from '../api';
import { transformUserData, transformBalanceData, transformBalanceHistoryItem, transformTradeSettings } from '../services/accountService';

/**
 * 使用帳戶資料的 Hook
 */
export const useAccount = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  // 取得使用者資料
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await accountAPI.getProfile();
      const transformed = transformUserData(data);
      setProfile(transformed);
      return transformed;
    } catch (error) {
      message.error(error.msg || '取得使用者資料失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 更新使用者資料
  const updateProfile = async (profileData) => {
    setLoading(true);
    try {
      const data = await accountAPI.updateProfile(profileData);
      const transformed = transformUserData(data);
      setProfile(transformed);
      message.success('個人資料更新成功');
      return transformed;
    } catch (error) {
      message.error(error.msg || '更新個人資料失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 上傳頭像
  const uploadAvatar = async (file) => {
    setLoading(true);
    try {
      const data = await accountAPI.uploadAvatar(file);
      const transformed = transformUserData(data);
      setProfile(transformed);
      message.success('頭像上傳成功');
      return transformed;
    } catch (error) {
      message.error(error.msg || '頭像上傳失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 恢復 Google 頭像
  const restoreGoogleAvatar = async () => {
    setLoading(true);
    try {
      const data = await accountAPI.restoreGoogleAvatar();
      const transformed = transformUserData(data);
      setProfile(transformed);
      message.success('已恢復 Google 頭像');
      return transformed;
    } catch (error) {
      message.error(error.msg || '恢復 Google 頭像失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    fetchProfile,
    updateProfile,
    uploadAvatar,
    restoreGoogleAvatar,
  };
};

/**
 * 使用餘額資料的 Hook
 */
export const useBalance = () => {
  const [balance, setBalance] = useState({
    balance: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    availableBalance: 0,
  });
  const [loading, setLoading] = useState(false);

  // 取得餘額
  const fetchBalance = async () => {
    setLoading(true);
    try {
      const data = await accountAPI.getBalance();
      const transformed = transformBalanceData(data);
      setBalance(transformed);
      return transformed;
    } catch (error) {
      message.error(error.msg || '取得餘額失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 入金
  const deposit = async (depositData) => {
    setLoading(true);
    try {
      const data = await accountAPI.deposit(depositData);
      const transformed = transformBalanceData(data);
      setBalance(transformed);
      message.success('入金成功');
      return transformed;
    } catch (error) {
      message.error(error.msg || '入金失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 出金
  const withdraw = async (withdrawData) => {
    setLoading(true);
    try {
      const data = await accountAPI.withdraw(withdrawData);
      const transformed = transformBalanceData(data);
      setBalance(transformed);
      message.success('出金成功');
      return transformed;
    } catch (error) {
      message.error(error.msg || '出金失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  return {
    balance,
    loading,
    fetchBalance,
    deposit,
    withdraw,
  };
};

/**
 * 使用資金變動記錄的 Hook
 */
export const useBalanceHistory = (params = {}) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 取得資金變動記錄
  const fetchHistory = async (newParams = {}) => {
    setLoading(true);
    try {
      const mergedParams = { ...params, ...newParams };
      const data = await accountAPI.getBalanceHistory(mergedParams);
      
      const items = Array.isArray(data.data) 
        ? data.data.map(transformBalanceHistoryItem)
        : Array.isArray(data) 
          ? data.map(transformBalanceHistoryItem)
          : [];
      
      setHistory(items);
      
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page || data.pagination.current || 1,
          pageSize: data.pagination.per_page || data.pagination.pageSize || 10,
          total: data.pagination.total || 0,
        });
      }
      
      return items;
    } catch (error) {
      message.error(error.msg || '取得資金變動記錄失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return {
    history,
    loading,
    pagination,
    fetchHistory,
  };
};

/**
 * 使用交易設定的 Hook
 */
export const useTradeSettings = () => {
  const [settings, setSettings] = useState({
    buyFeeRate: 0.001425,
    sellFeeRate: 0.001425,
    minFee: 20,
  });
  const [loading, setLoading] = useState(false);

  // 取得交易設定
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await accountAPI.getTradeSettings();
      const transformed = transformTradeSettings(data);
      setSettings(transformed);
      return transformed;
    } catch (error) {
      message.error(error.msg || '取得交易設定失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 更新交易設定
  const updateSettings = async (settingsData) => {
    setLoading(true);
    try {
      const data = await accountAPI.updateTradeSettings(settingsData);
      const transformed = transformTradeSettings(data);
      setSettings(transformed);
      message.success('交易設定更新成功');
      return transformed;
    } catch (error) {
      message.error(error.msg || '更新交易設定失敗');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    fetchSettings,
    updateSettings,
  };
};
