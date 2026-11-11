import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { message } from 'antd';
import { to } from 'await-to-js';
import { riskService, EMPTY_SUMMARY } from '../services/risk';

/**
 * 停損警示的全域狀態
 *
 * 側欄紅點、儀表板摘要條、風險中心頁都看同一份資料，所以放在 MainLayout 的 provider 裡，
 * 只打一次 API。標記已讀採樂觀更新，失敗才回滾——按鈕要立刻有反應，
 * 不該等一輪 round-trip 才變色。
 */
const RiskAlertsContext = createContext(null);

const REFRESH_MS = 5 * 60 * 1000;

const isSameAlert = (a, b) =>
  a.tradeId === b.tradeId && a.alertType === b.alertType && a.priceDate === b.priceDate;

export const RiskAlertsProvider = ({ children }) => {
  const [asOf, setAsOf] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAlerts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [err, data] = await to(riskService.fetchAlerts());
    if (!mountedRef.current) return;
    if (!err) {
      setAsOf(data.asOf);
      setAlerts(data.alerts);
      setSummary(data.summary);
      setLoaded(true);
    } else if (!silent) {
      message.error(err.msg || '載入停損警示失敗');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(() => fetchAlerts({ silent: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  const setAckLocal = useCallback((target, acknowledged) => {
    setAlerts((prev) =>
      prev.map((a) => (isSameAlert(a, target) ? { ...a, acknowledged } : a))
    );
  }, []);

  const acknowledge = useCallback(
    async (alert) => {
      setAckLocal(alert, true);
      const [err] = await to(riskService.acknowledge(alert));
      if (err) {
        setAckLocal(alert, false);
        message.error(err.msg || '標記已讀失敗');
      }
    },
    [setAckLocal]
  );

  const unacknowledge = useCallback(
    async (alert) => {
      setAckLocal(alert, false);
      const [err] = await to(riskService.unacknowledge(alert));
      if (err) {
        setAckLocal(alert, true);
        message.error(err.msg || '取消已讀失敗');
      }
    },
    [setAckLocal]
  );

  const acknowledgeAll = useCallback(async () => {
    const snapshot = alerts;
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    const [err] = await to(riskService.acknowledgeAll());
    if (err) {
      setAlerts(snapshot);
      message.error(err.msg || '全部標記失敗');
      return false;
    }
    return true;
  }, [alerts]);

  // 未讀數直接從清單算，避免 summary 與樂觀更新後清單不同步
  const unackedCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts]
  );

  const value = useMemo(
    () => ({
      asOf,
      alerts,
      summary,
      unackedCount,
      loading,
      loaded,
      refresh: () => fetchAlerts(),
      acknowledge,
      unacknowledge,
      acknowledgeAll,
    }),
    [
      asOf,
      alerts,
      summary,
      unackedCount,
      loading,
      loaded,
      fetchAlerts,
      acknowledge,
      unacknowledge,
      acknowledgeAll,
    ]
  );

  return (
    <RiskAlertsContext.Provider value={value}>{children}</RiskAlertsContext.Provider>
  );
};

export const useRiskAlerts = () => {
  const ctx = useContext(RiskAlertsContext);
  if (!ctx) throw new Error('useRiskAlerts 必須在 RiskAlertsProvider 內使用');
  return ctx;
};
