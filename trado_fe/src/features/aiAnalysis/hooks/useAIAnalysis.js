import { useState, useRef, useCallback } from 'react';
import { streamAnalysis } from '../api';

export function useAIAnalysis() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(async (period) => {
    setContent('');
    setError(null);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAnalysis(
        { period },
        {
          signal: controller.signal,
          onToken: (t) => setContent((prev) => prev + t),
        }
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || '分析失敗');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { content, loading, error, run, stop };
}

export default useAIAnalysis;
