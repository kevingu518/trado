# 開發指南

## 開發環境設置

### 必要條件

- Node.js >= 18.0.0
- Yarn >= 1.22.0（或 npm >= 9.0.0）

### 安裝步驟

1. **克隆專案**（如果適用）
```bash
git clone <repository-url>
cd trado-react
```

2. **安裝依賴**
```bash
yarn install
```

3. **設置環境變數**
```bash
# 複製 .env.example 並修改
cp .env.example .env

# 編輯 .env 文件
VITE_API_URL=https://api.example.com
```

4. **啟動開發伺服器**
```bash
yarn dev
```

開發伺服器將在 `http://localhost:5173` 啟動。

## 專案結構說明

### 目錄結構

```
src/
├── api/              # API 相關
│   ├── api_trade.js  # 交易 API
│   ├── api_user.js   # 使用者 API
│   ├── api.js        # API 配置
│   └── request.js    # Axios 封裝
├── components/       # 共用組件
├── config/           # 配置文件
├── hooks/            # 自定義 Hooks
├── layouts/          # 佈局組件
├── pages/            # 頁面組件
├── store/            # Redux Store
├── styles/           # 樣式文件
├── App.jsx           # 根組件
└── main.jsx          # 入口文件
```

### 檔案命名規範

- **組件檔案**：PascalCase（如 `TransactionDrawer.jsx`）
- **工具檔案**：camelCase（如 `useAuth.js`）
- **樣式檔案**：kebab-case（如 `transaction.scss`）
- **常數檔案**：UPPER_SNAKE_CASE（如 `API_CONSTANTS.js`）

## 開發規範

### 程式碼風格

#### 1. 組件結構

組件應按照以下順序組織：

```javascript
// 1. 引入
import React, { useState } from 'react'
import { Button, Modal } from 'antd'

// 2. 組件定義
const MyComponent = ({ prop1, prop2 }) => {
  // 3. 變數（使用註解分隔）
  // -------------------------   variables   ----------------------------
  const [state, setState] = useState(null)
  
  // 4. 配置（使用註解分隔）
  // -------------------------   configs   ----------------------------
  const options = [...]
  
  // 5. 函數（使用註解分隔）
  // -------------------------   functions   ----------------------------
  const handleClick = () => {
    // ...
  }
  
  // 6. 渲染
  return (
    <div>
      {/* JSX */}
    </div>
  )
}

export default MyComponent
```

#### 2. 狀態管理

- **全域狀態**：使用 Redux（如認證狀態、使用者資料）
- **組件狀態**：使用 `useState`（如表單狀態、UI 狀態）
- **衍生狀態**：使用 `useMemo` 或 `useCallback` 優化

#### 3. API 調用

統一使用 `await-to-js` 處理錯誤：

```javascript
import to from 'await-to-js';
import { login } from '@/api/api_user';

const [error, response] = await to(login(credentials));

if (error) {
  message.error(error.msg || '操作失敗');
  return;
}

// 處理成功響應
console.log(response);
```

#### 4. 錯誤處理

- 使用 Ant Design 的 `message` 組件顯示錯誤訊息
- API 錯誤統一在 `request.js` 攔截器中處理
- 組件錯誤使用 Error Boundary 捕獲

#### 5. 樣式管理

- 優先使用 Ant Design 組件的樣式
- 自定義樣式使用 SCSS
- 使用 utility classes（在 `styles/utils.scss` 中定義）
- 避免 inline style，除非是動態樣式

### Git 提交規範

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 類型**：
- `feat`: 新功能
- `fix`: 修復 bug
- `docs`: 文檔變更
- `style`: 程式碼格式變更（不影響功能）
- `refactor`: 重構
- `perf`: 效能優化
- `test`: 測試相關
- `chore`: 建置過程或輔助工具的變更

**範例**：
```
feat(transactions): 新增交易記錄過濾功能

- 新增股票代碼過濾
- 新增策略過濾
- 新增多空方向過濾
```

## 新增功能開發流程

### 1. 新增頁面

1. 在 `src/pages/` 下建立新目錄
2. 建立 `index.jsx` 檔案
3. 在 `src/App.jsx` 中新增路由
4. 如需樣式，在 `src/styles/pages/` 下新增 SCSS 檔案

**範例**：
```javascript
// src/pages/NewPage/index.jsx
import React from 'react'

const NewPage = () => {
  return (
    <div className="NewPage">
      <h1>新頁面</h1>
    </div>
  )
}

export default NewPage
```

### 2. 新增 API

1. 在 `src/api/` 下找到對應的 API 檔案（或建立新檔案）
2. 使用 `request` 實例發送請求
3. 匯出 API 函數

**範例**：
```javascript
// src/api/api_trade.js
import request from './request';

export const getTransactions = (params = {}) => {
  return request.get('/transactions', { params });
};

export const createTransaction = (data) => {
  return request.post('/transactions', data);
};
```

### 3. 新增組件

1. 在 `src/components/` 下建立組件檔案
2. 使用 PropTypes 或 TypeScript 定義 props
3. 如需樣式，建立對應的 SCSS 檔案

**範例**：
```javascript
// src/components/MyComponent.jsx
import React from 'react'
import PropTypes from 'prop-types'

const MyComponent = ({ title, onClick }) => {
  return (
    <div className="MyComponent">
      <h2>{title}</h2>
      <button onClick={onClick}>點擊</button>
    </div>
  )
}

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
}

export default MyComponent
```

### 4. 新增 Redux Slice

1. 在 `src/store/` 下建立新的 slice 檔案
2. 使用 `createSlice` 建立 slice
3. 在 `src/store/store.js` 中註冊 reducer

**範例**：
```javascript
// src/store/transactionsSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [],
  loading: false,
  error: null,
};

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action) => {
      state.list = action.payload;
    },
    // ... 其他 reducers
  },
});

export const { setTransactions } = transactionsSlice.actions;
export default transactionsSlice.reducer;
```

## 除錯技巧

### 1. React DevTools

安裝 React DevTools 瀏覽器擴充功能，用於檢查組件狀態和 props。

### 2. Redux DevTools

安裝 Redux DevTools 瀏覽器擴充功能，用於檢查 Redux store 狀態。

### 3. 網路請求除錯

在 `src/api/request.js` 中已加入 console.log，可在瀏覽器控制台查看請求詳情。

### 4. 常見問題

**問題：API 請求失敗**
- 檢查 `VITE_API_URL` 環境變數是否正確
- 檢查 Token 是否有效
- 查看瀏覽器 Network 面板的請求詳情

**問題：樣式不生效**
- 檢查 SCSS 檔案是否正確引入
- 檢查 class 名稱是否正確
- 檢查是否有樣式覆蓋問題

**問題：路由不工作**
- 檢查路由路徑是否正確
- 檢查 ProtectedRoute 是否正確設置
- 檢查認證狀態是否正確

## 測試

### 單元測試（待實作）

使用 Vitest 進行單元測試：

```bash
yarn test
```

### E2E 測試（待實作）

使用 Playwright 進行端到端測試：

```bash
yarn test:e2e
```

## 建置與部署

### 建置生產版本

```bash
yarn build
```

建置產物將輸出到 `dist/` 目錄。

### 預覽生產版本

```bash
yarn preview
```

### 部署

1. **建置專案**
```bash
yarn build
```

2. **部署到靜態主機**
   - 將 `dist/` 目錄內容上傳到靜態主機
   - 配置環境變數 `VITE_API_URL`

3. **部署到 Vercel/Netlify**
   - 連接 Git 倉庫
   - 設置建置命令：`yarn build`
   - 設置輸出目錄：`dist`
   - 設置環境變數

## 效能優化

### 1. 程式碼分割

使用 React.lazy 進行路由級別的程式碼分割：

```javascript
import { lazy, Suspense } from 'react';

const Transactions = lazy(() => import('./pages/Transactions'));

<Suspense fallback={<div>Loading...</div>}>
  <Transactions />
</Suspense>
```

### 2. 圖片優化

- 使用適當的圖片格式（WebP、AVIF）
- 使用圖片懶加載
- 壓縮圖片大小

### 3. 打包優化

- 使用 Vite 的建置優化功能
- 分析打包大小：`yarn build --analyze`
- 移除未使用的依賴

## 程式碼審查檢查清單

提交 PR 前請確認：

- [ ] 程式碼符合專案規範
- [ ] 無 console.log 或除錯程式碼
- [ ] 無未使用的 import
- [ ] 通過 ESLint 檢查
- [ ] 功能正常運作
- [ ] 無明顯效能問題
- [ ] 文檔已更新（如需要）

## 參考資源

- [React 官方文檔](https://react.dev/)
- [Ant Design 文檔](https://ant.design/)
- [Redux Toolkit 文檔](https://redux-toolkit.js.org/)
- [React Router 文檔](https://reactrouter.com/)
- [Vite 文檔](https://vitejs.dev/)

## 常見任務

### 新增交易記錄欄位

1. 更新 `docs/DATA_MODEL.md` 中的 Position 介面
2. 更新 `AddPositionModal.jsx` 表單
3. 更新 `TransactionDrawer.jsx` 顯示邏輯
4. 更新 API 規格（如需要）

### 新增過濾條件

1. 在 `Transactions/index.jsx` 中新增狀態
2. 更新 `getFilteredData` 函數
3. 在 UI 中新增過濾器組件
4. 更新 API 請求參數（如需要）

### 修改樣式

1. 檢查是否有對應的 SCSS 檔案
2. 使用 Ant Design 的 theme 配置（如需要）
3. 避免使用 !important（除非必要）
4. 確保響應式設計正常
