# 帳戶管理 API 定義文件

## 概述

本文檔定義了帳戶管理相關的 API 接口，包括個人資料、資金管理和交易設定等功能。

**Base URL**: `/api` (由 `VITE_API_URL` 環境變數設定)

**認證方式**: 所有 API 都需要在 Header 中攜帶 Bearer Token
```
Authorization: Bearer {access_token}
```

---

## 1. 個人資料相關 API

### 1.1 取得當前使用者資料

**GET** `/account/profile`

**說明**: 取得當前登入使用者的個人資料

**請求參數**: 無

**回應範例**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "張三",
    "avatar": "https://example.com/avatar.jpg",
    "login_type": "google",
    "google_id": "google_123",
    "google_avatar": "https://lh3.googleusercontent.com/...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**欄位說明**:
- `login_type`: 登入方式（`google` 或 `email`）
- `google_id`: Google 使用者 ID（僅 Google 登入使用者有此欄位）
- `google_avatar`: Google 原始頭像 URL（僅 Google 登入使用者有此欄位）

**錯誤回應**:
```json
{
  "status": 401,
  "msg": "未授權，請先登入"
}
```

---

### 1.2 更新使用者資料

**PUT** `/account/profile`

**說明**: 更新當前使用者的個人資料

**請求 Body**:
```json
{
  "name": "張三"
}
```

**回應範例**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "張三",
    "avatar": "https://example.com/avatar.jpg",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**錯誤回應**:
```json
{
  "status": 400,
  "msg": "姓名不能超過 50 個字元"
}
```

---

### 1.3 上傳頭像

**POST** `/account/avatar`

**說明**: 上傳使用者頭像

**請求格式**: `multipart/form-data`

**請求 Body**:
- `avatar`: File (圖片檔案，支援 JPG/PNG，最大 2MB)

**回應範例**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "張三",
    "avatar": "https://example.com/uploads/avatar_123.jpg",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**錯誤回應**:
```json
{
  "status": 400,
  "msg": "圖片大小不能超過 2MB"
}
```

---

### 1.4 恢復 Google 頭像

**POST** `/account/avatar/restore-google`

**說明**: 恢復使用 Google 帳號的原始頭像（僅限 Google 登入使用者）

**請求參數**: 無

**回應範例**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@gmail.com",
    "name": "張三",
    "avatar": "https://lh3.googleusercontent.com/...",
    "login_type": "google",
    "google_id": "google_123",
    "google_avatar": "https://lh3.googleusercontent.com/...",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**錯誤回應**:
```json
{
  "status": 400,
  "msg": "此功能僅限 Google 登入使用者使用"
}
```

---

## 2. 資金管理相關 API

### 2.1 取得帳戶餘額

**GET** `/account/balance`

**說明**: 取得當前使用者的帳戶餘額資訊

**請求參數**: 無

**回應範例**:
```json
{
  "success": true,
  "data": {
    "balance": 1000000,
    "total_deposit": 1500000,
    "total_withdraw": 500000,
    "available_balance": 1000000
  }
}
```

**欄位說明**:
- `balance`: 當前餘額（元）
- `total_deposit`: 總入金金額（元）
- `total_withdraw`: 總出金金額（元）
- `available_balance`: 可用餘額（元）

---

### 2.2 取得資金變動記錄

**GET** `/account/balance/history`

**說明**: 取得資金變動歷史記錄

**請求參數** (Query Parameters):
- `page`: 頁碼（選填，預設 1）
- `per_page`: 每頁筆數（選填，預設 10）
- `start_date`: 開始日期（選填，格式：YYYY-MM-DD）
- `end_date`: 結束日期（選填，格式：YYYY-MM-DD）
- `type`: 類型（選填，`deposit` 或 `withdraw`）

**回應範例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "trans_001",
      "type": "deposit",
      "amount": 100000,
      "balance": 1000000,
      "date": "2024-01-15",
      "method": "銀行轉帳",
      "notes": "初始資金"
    },
    {
      "id": "trans_002",
      "type": "withdraw",
      "amount": 50000,
      "balance": 950000,
      "date": "2024-01-20",
      "method": "銀行轉帳",
      "notes": "提領部分資金"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total": 2,
    "total_pages": 1
  }
}
```

**欄位說明**:
- `id`: 交易記錄 ID
- `type`: 類型（`deposit` 入金 / `withdraw` 出金）
- `amount`: 金額（元）
- `balance`: 交易後餘額（元）
- `date`: 交易日期（YYYY-MM-DD）
- `method`: 交易方式（選填）
- `notes`: 備註（選填）

---

### 2.3 入金

**POST** `/account/deposit`

**說明**: 新增一筆入金記錄

**請求 Body**:
```json
{
  "amount": 100000,
  "date": "2024-01-15",
  "method": "銀行轉帳",
  "notes": "初始資金"
}
```

**請求欄位說明**:
- `amount`: 入金金額（必填，必須 > 0）
- `date`: 交易日期（必填，格式：YYYY-MM-DD，不能超過今天）
- `method`: 入金方式（選填）
- `notes`: 備註（選填，最多 200 字）

**回應範例**:
```json
{
  "success": true,
  "data": {
    "balance": 1100000,
    "total_deposit": 1600000,
    "total_withdraw": 500000,
    "available_balance": 1100000
  }
}
```

**錯誤回應**:
```json
{
  "status": 400,
  "msg": "入金金額必須大於 0"
}
```

---

### 2.4 出金

**POST** `/account/withdraw`

**說明**: 新增一筆出金記錄

**請求 Body**:
```json
{
  "amount": 50000,
  "date": "2024-01-20",
  "method": "銀行轉帳",
  "notes": "提領部分資金"
}
```

**請求欄位說明**:
- `amount`: 出金金額（必填，必須 > 0，且不能超過可用餘額）
- `date`: 交易日期（必填，格式：YYYY-MM-DD，不能超過今天）
- `method`: 出金方式（選填）
- `notes`: 備註（選填，最多 200 字）

**回應範例**:
```json
{
  "success": true,
  "data": {
    "balance": 950000,
    "total_deposit": 1500000,
    "total_withdraw": 550000,
    "available_balance": 950000
  }
}
```

**錯誤回應**:
```json
{
  "status": 400,
  "msg": "出金金額不能超過可用餘額"
}
```

---

## 3. 交易設定相關 API

### 3.1 取得交易設定

**GET** `/account/trade-settings`

**說明**: 取得當前使用者的交易設定

**請求參數**: 無

**回應範例**:
```json
{
  "success": true,
  "data": {
    "buy_fee_rate": 0.001425,
    "sell_fee_rate": 0.001425,
    "min_fee": 20
  }
}
```

**欄位說明**:
- `buy_fee_rate`: 買入手續費率（小數，例如 0.001425 表示 0.1425%）
- `sell_fee_rate`: 賣出手續費率（小數，例如 0.001425 表示 0.1425%）
- `min_fee`: 最低手續費（元）

---

### 3.2 更新交易設定

**PUT** `/account/trade-settings`

**說明**: 更新交易設定

**請求 Body**:
```json
{
  "buy_fee_rate": 0.001425,
  "sell_fee_rate": 0.001425,
  "min_fee": 20
}
```

**請求欄位說明**:
- `buy_fee_rate`: 買入手續費率（必填，0-1 之間的小數）
- `sell_fee_rate`: 賣出手續費率（必填，0-1 之間的小數）
- `min_fee`: 最低手續費（必填，0-100 之間的整數）

**回應範例**:
```json
{
  "success": true,
  "data": {
    "buy_fee_rate": 0.001425,
    "sell_fee_rate": 0.001425,
    "min_fee": 20
  }
}
```

**錯誤回應**:
```json
{
  "status": 400,
  "msg": "手續費率必須在 0 到 1 之間"
}
```

---

## 通用錯誤回應格式

所有 API 在發生錯誤時，都會返回以下格式：

```json
{
  "status": 400,
  "msg": "錯誤訊息"
}
```

**常見 HTTP 狀態碼**:
- `200`: 成功
- `400`: 請求參數錯誤
- `401`: 未授權（需要登入）
- `403`: 禁止訪問
- `404`: 資源不存在
- `500`: 伺服器錯誤

---

## 資料格式說明

### 日期格式
所有日期欄位都使用 ISO 8601 格式：`YYYY-MM-DD`

### 金額格式
所有金額欄位都是數字（元），不包含貨幣符號

### 手續費率格式
手續費率以小數形式儲存，例如：
- `0.001425` 表示 0.1425%
- `0.0015` 表示 0.15%

---

## 注意事項

1. 所有 API 都需要認證，請確保在請求 Header 中攜帶有效的 Access Token
2. 入金和出金操作會即時更新帳戶餘額
3. 出金金額不能超過當前可用餘額
4. 手續費設定會影響所有交易記錄的盈虧計算
5. 日期不能超過當前日期
