import { useState, useEffect, useCallback } from 'react';
import { to } from 'await-to-js';
import { aiAnalysisAPI } from '../api';

export function useAISettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [err, data] = await to(aiAnalysisAPI.getSettings());
    if (!err) setSettings(data);
    setLoading(false);
    return { err, data };
  }, []);

  const save = useCallback(async (payload) => {
    setSaving(true);
    const [err, data] = await to(aiAnalysisAPI.updateSettings(payload));
    if (!err) setSettings(data);
    setSaving(false);
    return { err, data };
  }, []);

  const clearKey = useCallback(async () => {
    setSaving(true);
    const [err, data] = await to(aiAnalysisAPI.clearSettings());
    if (!err) setSettings(data);
    setSaving(false);
    return { err, data };
  }, []);

  const test = useCallback(async (payload = {}) => {
    const [err, data] = await to(aiAnalysisAPI.test(payload));
    return { err, data };
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { settings, loading, saving, reload, save, clearKey, test };
}

export default useAISettings;
