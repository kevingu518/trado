import request from '@/api/request';

export const aiAnalysisAPI = {
  // 取得 AI 設定（不含金鑰明文，只回 hasKey / keyMask）
  getSettings: () => request.get('/ai-analysis/settings'),

  // 更新 AI 設定（provider / model / api_key）
  // api_key：非空字串=更新；空字串=清除；undefined=不變
  updateSettings: (data) => request.put('/ai-analysis/settings', data),

  // 清除已儲存的金鑰
  clearSettings: () => request.delete('/ai-analysis/settings'),

  // 測試連線（可帶 provider/model/api_key 測尚未存檔的設定；皆不帶則測已存設定）
  test: (data = {}) => request.post('/ai-analysis/test', data),
};

/**
 * 串流分析。繞過 axios instance（interceptor 會吃掉串流），改用原生 fetch + ReadableStream。
 * @param {{period:string}} body
 * @param {{onToken:(text:string)=>void, signal?:AbortSignal}} handlers
 */
export async function streamAnalysis({ period }, { onToken, signal } = {}) {
  const baseURL = import.meta.env.VITE_API_URL || '';
  const token = sessionStorage.getItem('access_token');

  const res = await fetch(`${baseURL}/ai-analysis/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ period }),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = '分析失敗';
    try {
      const j = await res.json();
      msg = j?.error?.message || msg;
    } catch {
      /* 非 JSON 回應，沿用預設訊息 */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) onToken?.(decoder.decode(value, { stream: true }));
  }
}
