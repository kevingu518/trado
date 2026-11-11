/**
 * 原生 fetch 的共用入口（給「需要原始傳輸」的端點用）。
 *
 * 為什麼不跟其他 api_*.js 一樣走 request.js（axios）：
 * 1. 匯入的檔案要當 request body 直接送出（後端用 express.raw 收位元組），
 *    axios 會把 body 再包一層；匯出則需要讀 response header（檔名、筆數）
 *    與 Blob，而 request.js 的 response 攔截器只回傳 data，header 會被吃掉。
 * 2. request.js 的錯誤攔截器讀的是 `error.response.data.msg`，但後端錯誤格式是
 *    `{ success: false, error: { message } }`，走 axios 會讓「必填欄位尚未對應：日期」
 *    這類訊息變成 undefined。這裡直接讀 error.message，錯誤訊息才傳得到 UI。
 *
 * 因此只有匯入 / 匯出這幾條端點走這裡，其餘一律照舊用 api_*.js + request.js。
 */
const getBaseURL = () => import.meta.env.VITE_API_URL || '';

const authHeaders = () => {
  const token = sessionStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * query 只收字串：物件（例如 mapping）自動轉 JSON。
 * undefined / null / 空字串一律略過，避免送出不存在的參數。
 * 注意 false 會被保留（'false'），後端才分得出「明確關閉」與「沒帶」。
 */
const toQuery = (query = {}) => {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

/** 後端錯誤格式：{ success: false, error: { message } } */
const readErrorMessage = async (res, fallback) => {
  try {
    const body = await res.json();
    return body?.error?.message || fallback;
  } catch {
    // 非 JSON 回應（例如 413 由 body parser 直接擋掉）
    return fallback;
  }
};

/**
 * 送出請求並回傳 Response（未解析），讓呼叫端自己決定讀 json 還是 blob。
 * @param {string} path 例如 '/trade-import/preview'
 * @param {{method?:string, body?:BodyInit, query?:object, json?:object}} options
 *   - body：原始位元組（File / Blob），Content-Type 由瀏覽器依檔案型別自動帶
 *   - json：改用 JSON 傳輸（會自動序列化並補上 Content-Type）
 */
export async function rawRequest(path, { method = 'GET', body, query, json } = {}) {
  const headers = { ...authHeaders() };
  let payload = body;

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(json);
  }

  const res = await fetch(`${getBaseURL()}${path}${toQuery(query)}`, {
    method,
    headers,
    credentials: 'include',
    body: payload,
  });

  if (!res.ok) {
    if (res.status === 401) {
      // 這裡沒有 request.js 的自動刷新 token 流程：明講讓使用者重新整理再試，
      // 不要讓他以為是檔案或對應有問題。
      throw new Error('登入已過期，請重新整理頁面後再試');
    }
    throw new Error(await readErrorMessage(res, `請求失敗（HTTP ${res.status}）`));
  }

  return res;
}

/** 取得 JSON 並拆掉 { success, data } 外層 */
export async function rawJson(path, options) {
  const res = await rawRequest(path, options);
  const body = await res.json();
  return body?.data ?? body;
}

export default rawRequest;
