# Trado React - 交易紀錄管理系統

一個用於記錄和管理股票交易紀錄的 Web 應用程式，幫助交易者追蹤交易、分析表現並進行交易檢討。

## 專案概述

Trado React 是一個基於 React 的交易紀錄管理系統 MVP，主要功能包括：

- **登入系統**：使用者認證與授權
- **交易紀錄功能**：記錄交易開單、建倉位，並進行交易檢討

## 技術棧

- **前端框架**：React 19.1.1
- **建置工具**：Vite 7.1.2
- **UI 框架**：Ant Design 5.27.1
- **狀態管理**：Redux Toolkit 2.8.2 + React Redux 9.2.0
- **路由管理**：React Router DOM 7.8.2
- **HTTP 客戶端**：Axios 1.11.0
- **樣式處理**：Sass 1.90.0
- **日期處理**：Day.js 1.11.18

## 快速開始

### 安裝依賴

```bash
yarn install
```

### 開發模式

```bash
yarn dev
```

### 建置生產版本

```bash
yarn build
```

### 預覽生產版本

```bash
yarn preview
```

## 專案結構

```
trado-react/
├── public/                 # 靜態資源
├── src/
│   ├── api/               # API 相關
│   │   ├── api_trade.js   # 交易相關 API
│   │   ├── api_user.js    # 使用者相關 API
│   │   ├── api.js         # API 配置
│   │   └── request.js     # Axios 封裝
│   ├── components/        # 共用組件
│   │   └── ProtectedRoute.jsx
│   ├── config/            # 配置文件
│   │   └── theme.config.js
│   ├── hooks/             # 自定義 Hooks
│   │   └── useAuth.js
│   ├── layouts/           # 佈局組件
│   │   ├── AuthLayout.jsx
│   │   └── MainLayout.jsx
│   ├── pages/             # 頁面組件
│   │   ├── Login/         # 登入頁面
│   │   ├── Register/      # 註冊頁面
│   │   ├── ForgotPassword/# 忘記密碼頁面
│   │   ├── Transactions/  # 交易紀錄頁面
│   │   └── Trades/        # 交易頁面
│   ├── store/             # Redux Store
│   │   ├── authSlice.js
│   │   └── store.js
│   ├── styles/            # 樣式文件
│   ├── App.jsx            # 根組件
│   └── main.jsx           # 入口文件
├── eslint.config.js
├── package.json
├── vite.config.js
└── README.md
```

## 主要功能

### 1. 登入系統
- 使用者登入/註冊
- 忘記密碼功能
- 路由保護（ProtectedRoute）
- Token 管理與自動刷新

### 2. 交易紀錄功能
- **開單（Position）**：建立新的交易記錄
- **建倉位（Fill）**：為交易記錄添加倉位變動
- **交易檢討**：記錄交易心得、錯誤分類、情緒狀態等
- **過濾與搜尋**：依股票代碼、策略、多空方向等條件過濾
- **統計分析**：顯示持倉統計、盈虧分析等資訊

## 環境變數

建立 `.env` 文件並設定以下變數：

```env
VITE_API_URL=https://api.example.com
```

## 相關文檔

詳細文檔請參考 `docs/` 目錄：

- [系統架構](docs/ARCHITECTURE.md)
- [功能規格](docs/FEATURES.md)
- [資料模型](docs/DATA_MODEL.md)
- [API 規格](docs/API.md)
- [開發指南](docs/DEVELOPMENT.md)

## 授權

本專案為私有專案。
