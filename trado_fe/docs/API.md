# API 規格文檔

## 概述

本文檔描述 Trado React 系統的 API 介面規格。目前系統使用 mock 資料，未來需要整合真實的後端 API。

## API 基礎配置

### Base URL

```javascript
// 開發環境
VITE_API_URL=https://api.example.com

// 生產環境
VITE_API_URL=https://api.production.com
```

### 認證方式

使用 Bearer Token 認證：

```http
Authorization: Bearer {access_token}
```

Token 儲存在 `sessionStorage` 中，key 為 `access_token`。

### 請求格式

- **Content-Type**: `application/json`
- **請求體**: JSON 格式

### 響應格式

標準響應格式：

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  status?: number;
}
```

錯誤響應：

```typescript
interface ApiError {
  success: false;
  status: number;
  msg: string;
  data?: any;
}
```

## 認證相關 API

### 1. 使用者登入

**端點**：`POST /auth/login`

**請求體**：
```typescript
{
  email: string;      // 電子信箱
  password: string;   // 密碼
}
```

**響應**：
```typescript
{
  success: true,
  data: {
    accessToken: string;  // Access Token
    user: {
      id: string;
      email: string;
      name?: string;
      avatar?: string;
    }
  }
}
```

**錯誤響應**：
- `400`: 請求參數錯誤
- `401`: 帳號或密碼錯誤
- `500`: 伺服器錯誤

**相關檔案**：
- `src/api/api_user.js` - `login` 函數
- `src/pages/Login/index.jsx` - 使用範例

---

### 2. 使用者註冊

**端點**：`POST /auth/register`

**請求體**：
```typescript
{
  email: string;           // 電子信箱
  password: string;        // 密碼
  confirmPassword: string; // 確認密碼
  name?: string;          // 姓名（選填）
}
```

**響應**：
```typescript
{
  success: true,
  data: {
    user: {
      id: string;
      email: string;
      name?: string;
    }
  },
  message: "註冊成功"
}
```

**錯誤響應**：
- `400`: 請求參數錯誤（如密碼不符合要求、信箱已存在）
- `500`: 伺服器錯誤

**相關檔案**：
- `src/api/api_user.js` - `register` 函數
- `src/pages/Register/index.jsx` - 使用範例

---

### 3. 忘記密碼

**端點**：`POST /auth/forgot-password`

**請求體**：
```typescript
{
  email: string;  // 電子信箱
}
```

**響應**：
```typescript
{
  success: true,
  message: "重設密碼連結已發送到您的信箱"
}
```

**相關檔案**：
- `src/api/api_user.js` - 待實作
- `src/pages/ForgotPassword/index.jsx` - 使用範例

---

### 4. 登出

**端點**：`POST /auth/logout`

**請求頭**：
```http
Authorization: Bearer {access_token}
```

**響應**：
```typescript
{
  success: true,
  message: "登出成功"
}
```

**相關檔案**：
- `src/api/api_user.js` - `logout` 函數

---

### 5. 刷新 Token

**端點**：`POST /auth/refresh`

**請求**：
- 使用 HTTP-Only Cookie 中的 refresh_token（由後端自動處理）

**響應**：
```typescript
{
  success: true,
  data: {
    access_token: string;
    refresh_token?: string;  // 如果後端返回新的 refresh token
  }
}
```

**相關檔案**：
- `src/api/request.js` - 響應攔截器自動處理

## 交易相關 API

### 1. 取得交易記錄列表

**端點**：`GET /transactions`

**請求參數**（Query String）：
```typescript
{
  page?: number;        // 頁碼（預設 1）
  pageSize?: number;   // 每頁筆數（預設 10）
  stockCode?: string;  // 股號過濾
  strategy?: string;   // 策略過濾
  direction?: 'LONG' | 'SHORT';  // 多空過濾
  status?: 'open' | 'completed';  // 狀態過濾
  startDate?: string;  // 開始日期（YYYY-MM-DD）
  endDate?: string;    // 結束日期（YYYY-MM-DD）
}
```

**響應**：
```typescript
{
  success: true,
  data: {
    list: Position[];   // 交易記錄陣列
    total: number;      // 總筆數
    page: number;       // 當前頁碼
    pageSize: number;   // 每頁筆數
  }
}
```

**相關檔案**：
- `src/api/api_trade.js` - 待實作
- `src/pages/Transactions/index.jsx` - 使用範例

---

### 2. 取得單筆交易記錄

**端點**：`GET /transactions/:id`

**路徑參數**：
- `id`: 交易記錄 ID（key）

**響應**：
```typescript
{
  success: true,
  data: Position
}
```

**錯誤響應**：
- `404`: 交易記錄不存在

---

### 3. 建立交易記錄（開單）

**端點**：`POST /transactions`

**請求體**：
```typescript
{
  stockCode: string;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  openDate: string;      // YYYY-MM-DD
  closeDate?: string | null;  // YYYY-MM-DD
  notes?: string;
}
```

**響應**：
```typescript
{
  success: true,
  data: Position,
  message: "交易記錄已建立"
}
```

**相關檔案**：
- `src/api/api_trade.js` - 待實作
- `src/pages/Transactions/components/AddPositionModal.jsx` - 使用範例

---

### 4. 更新交易記錄

**端點**：`PUT /transactions/:id`

**路徑參數**：
- `id`: 交易記錄 ID

**請求體**：
```typescript
{
  stockCode?: string;
  direction?: 'LONG' | 'SHORT';
  strategy?: string;
  openDate?: string;
  closeDate?: string | null;
  status?: 'open' | 'completed';
  result?: number | null;
  discipline?: 'pass' | 'fail' | 'pending';
  notes?: string;
}
```

**響應**：
```typescript
{
  success: true,
  data: Position,
  message: "交易記錄已更新"
}
```

---

### 5. 刪除交易記錄

**端點**：`DELETE /transactions/:id`

**路徑參數**：
- `id`: 交易記錄 ID

**響應**：
```typescript
{
  success: true,
  message: "交易記錄已刪除"
}
```

---

### 6. 新增倉位記錄

**端點**：`POST /transactions/:id/fills`

**路徑參數**：
- `id`: 交易記錄 ID

**請求體**：
```typescript
{
  date: string;          // YYYY-MM-DD
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  stopLoss?: number | null;
  notes?: string;
}
```

**響應**：
```typescript
{
  success: true,
  data: Fill,
  message: "倉位記錄已添加"
}
```

**相關檔案**：
- `src/api/api_trade.js` - 待實作
- `src/pages/Transactions/components/AddFillModal.jsx` - 使用範例

---

### 7. 更新倉位記錄

**端點**：`PUT /transactions/:transactionId/fills/:fillId`

**路徑參數**：
- `transactionId`: 交易記錄 ID
- `fillId`: 倉位記錄 ID

**請求體**：
```typescript
{
  date?: string;
  action?: 'buy' | 'sell';
  price?: number;
  quantity?: number;
  stopLoss?: number | null;
  notes?: string;
}
```

**響應**：
```typescript
{
  success: true,
  data: Fill,
  message: "倉位記錄已更新"
}
```

---

### 8. 刪除倉位記錄

**端點**：`DELETE /transactions/:transactionId/fills/:fillId`

**路徑參數**：
- `transactionId`: 交易記錄 ID
- `fillId`: 倉位記錄 ID

**響應**：
```typescript
{
  success: true,
  message: "倉位記錄已刪除"
}
```

---

### 9. 更新交易檢討

**端點**：`PUT /transactions/:id/review`

**路徑參數**：
- `id`: 交易記錄 ID

**請求體**：
```typescript
{
  content: string;
  errorCategory: string;
  selfRating: number;
  emotion: string;
  discipline?: 'pass' | 'fail';
}
```

**響應**：
```typescript
{
  success: true,
  data: {
    review: Review;
    discipline: 'pass' | 'fail' | 'pending';
  },
  message: "交易檢討已保存"
}
```

**相關檔案**：
- `src/api/api_trade.js` - 待實作
- `src/pages/Transactions/components/TransactionDrawer.jsx` - 使用範例

## 使用者相關 API

### 1. 取得使用者資料

**端點**：`GET /users/me`

**請求頭**：
```http
Authorization: Bearer {access_token}
```

**響應**：
```typescript
{
  success: true,
  data: User
}
```

**相關檔案**：
- `src/api/api_user.js` - `userAPI.getUser` 函數

---

### 2. 更新使用者資料

**端點**：`PUT /users/:id`

**路徑參數**：
- `id`: 使用者 ID

**請求體**：
```typescript
{
  name?: string;
  avatar?: string;
}
```

**響應**：
```typescript
{
  success: true,
  data: User,
  message: "使用者資料已更新"
}
```

## 錯誤處理

### HTTP 狀態碼

| 狀態碼 | 說明 |
|--------|------|
| 200 | 請求成功 |
| 201 | 建立成功 |
| 400 | 請求參數錯誤 |
| 401 | 未授權（Token 無效或過期） |
| 403 | 禁止訪問 |
| 404 | 資源不存在 |
| 429 | 請求過於頻繁 |
| 500 | 伺服器錯誤 |

### 錯誤響應格式

```typescript
{
  success: false,
  status: number,
  msg: string,
  data?: any
}
```

### 前端錯誤處理

錯誤處理在 `src/api/request.js` 的響應攔截器中統一處理：

1. **401 錯誤**：自動嘗試刷新 Token
2. **其他錯誤**：返回錯誤物件，由調用方處理

## API 調用範例

### 使用 await-to-js 處理錯誤

```javascript
import to from 'await-to-js';
import { login } from '@/api/api_user';

const [error, response] = await to(login({
  email: 'user@example.com',
  password: 'password123'
}));

if (error) {
  message.error(error.msg || '登入失敗');
  return;
}

// 處理成功響應
console.log(response);
```

### 使用 try-catch 處理錯誤

```javascript
import { addTrade } from '@/api/api_trade';

try {
  const response = await addTrade({
    stockCode: '2330',
    direction: 'LONG',
    strategy: '波段',
    openDate: '2024-01-15'
  });
  message.success('交易記錄已建立');
} catch (error) {
  message.error(error.msg || '建立失敗');
}
```

## 目前實作狀態

### 已實作

- ✅ 登入 API (`POST /auth/login`)
- ✅ 註冊 API (`POST /auth/register`)
- ✅ 登出 API (`POST /auth/logout`)
- ✅ Token 自動刷新機制
- ✅ 請求/響應攔截器

### 待實作

- ⏳ 交易記錄相關 API（目前使用 mock 資料）
- ⏳ 倉位記錄相關 API
- ⏳ 交易檢討相關 API
- ⏳ 使用者資料相關 API
- ⏳ 忘記密碼 API

## 未來規劃

1. **API 版本控制**：使用 URL 版本號（如 `/api/v1/transactions`）
2. **請求限流**：實作請求頻率限制
3. **WebSocket 支援**：即時更新交易記錄
4. **批次操作**：支援批次新增/更新交易記錄
5. **資料匯出**：提供匯出 API（Excel/CSV）
