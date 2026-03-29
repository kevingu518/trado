import axios from 'axios';

// 創建 Axios instance
const request = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // 確保請求攜帶 Cookie（如果後端需要）
  withCredentials: true,
});

// 請求攔截器
request.interceptors.request.use(
  (config) => {
    // 從 sessionStorage 讀取 access token
    const accessToken = sessionStorage.getItem('access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 響應攔截器
request.interceptors.response.use(
  (response) => {
    // response.data 才是後端的輸出格式。
    // response會有一層 axois 的包裝
    console.log({response});
    console.log('response.data',response.data);
    // 如果後端回應包含 pagination，返回完整的 response.data
    // 否則返回 response.data.data（向後兼容）
    if (response.data && response.data.pagination !== undefined) {
      return response.data;
    }
    return response.data.data || response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.data?.status || error.response?.status;
    const msg = error.response?.data?.msg || error.message;

    // 處理 401 錯誤
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // 如果當前在登入頁面，不要嘗試刷新 token，直接跳轉
      if (window.location.pathname === '/auth/login' || window.location.pathname === '/login') {
        sessionStorage.removeItem('access_token');
        return Promise.reject({
          status: 401,
          msg: '未授權，請先登入',
        });
      }

      try {
        // 假設 Refresh Token 由後端從 HTTP-Only Cookie 自動處理
        const { data } = await axios.post(
          `${request.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true } // 確保攜帶 Cookie
        );

        const { access_token, refresh_token } = data;
        // 更新 Access Token 到 sessionStorage
        sessionStorage.setItem('access_token', access_token);
        // 如果後端返回新的 Refresh Token，假設它已自動更新到 Cookie
        // 若需要前端手動設置 Cookie，可在此處添加 setCookie 邏輯

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return request(originalRequest);
      } catch (refreshError) {
        // 清除 Access Token
        sessionStorage.removeItem('access_token');
        // Refresh Token 由後端管理，無需前端清除 Cookie
        // 只有在非登入頁面時才跳轉，避免循環重定向
        if (window.location.pathname !== '/auth/login' && window.location.pathname !== '/login') {
          window.location.href = '/auth/login';
        }
        return Promise.reject({
          status: refreshError.response?.data?.status || 401,
          msg: refreshError.response?.data?.msg || 'Failed to refresh token',
        });
      }
    }

    // 其他錯誤處理
    switch (status) {
      case 400:
        console.error(`Bad Request: ${msg}`);
        break;
      case 403:
        console.error(`Forbidden: ${msg}`);
        break;
      case 404:
        console.error(`Not Found: ${msg}`);
        break;
      case 429:
        console.error(`Too Many Requests: ${msg}`);
        break;
      case 500:
        console.error(`Server Error: ${msg}`);
        break;
      default:
        console.error(`Error: ${msg}`);
    }

    return Promise.reject({ status, msg });
  }
);

// 上傳檔案方法
request.upload = (url, formData, config = {}) => {
  return request.post(url, formData, {
    ...config,
    headers: {
      ...config.headers,
      'Content-Type': 'multipart/form-data',
    },
  });
};

export default request;