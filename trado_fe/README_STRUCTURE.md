# 專案架構規範 (Project Structure & Standards)

本專案採用 **Feature-based (功能導向)** 的架構設計，旨在確保中型專案在擴充時保持高度的可維護性與邏輯清晰。

## 📂 目錄結構

```text
src/
├── api/                # 全域配置 (Axios Instance, Interceptors)
├── assets/             # 靜態資源 (Images, Icons, Global Styles)
├── components/         # 全域共用 UI 元件 (如 CommonButton, Layout)
├── constants/          # 全域常數 (如 API_URL, STATUS_CODES)
├── features/           # 核心業務功能模組 (Feature-based)
│   └── transactions/   # 交易紀錄功能模組
│       ├── api.js      # 該功能的 API 請求定義
│       ├── components/ # 該功能專用的 UI 元件
│       ├── hooks/      # 該功能專用的 TanStack Query Hooks
│       ├── services/   # 商業邏輯、資料轉換 (DTO)
│       └── constants.js# 該功能專用的常數 (如 分類選項)
├── hooks/              # 全域共用 Hooks (如 useAuth, useDebounce)
├── store/              # 全域狀態管理 (Zustand)
├── utils/              # 通用工具函式 (如 formatCurrency, dateHelper)
├── App.jsx             # 路由配置與 Provider 進入點
└── main.jsx            # 程式進入點


## 🏗️ 開發分層規範 (Layered Architecture)

為了確保職責分離 (Separation of Concerns)，我們嚴格遵循以下四層架構，每一層都有其明確的任務：

### 1. API 層 (The Communication Layer)
- **檔案位置**: `features/[feature-name]/api.js`
- **職責**: 純粹與後端溝通，定義 `axios` 請求。
- **原則**: 
    - 不處理任何 UI 狀態（如 Loading）。
    - 函式命名應為 `getXXX`, `postXXX`, `deleteXXX`。

### 2. Services / DTO 層 (The Logic & Transformation Layer) 🚀 *重點補強*
- **檔案位置**: `features/[feature-name]/services/`
- **職責**: 
    - **資料轉換 (DTO)**：將後端不友好的欄位（如 `t_amt_fixed`）轉換為前端易懂的格式（如 `amount`）。
    - **商業邏輯**：處理複雜的計算、過濾或資料格式化（如貨幣轉換）。
- **原則**: 讓 UI 層拿到的資料是「乾淨且直接可用」的。

### 3. Hooks 層 (The State Management Layer)
- **檔案位置**: `features/[feature-name]/hooks/`
- **職責**: 
    - 使用 **TanStack Query** 管理伺服器狀態。
    - 處理「請求何時發送」、「資料何時失效 (Invalidation)」以及「自動重新抓取」。
- **原則**: 封裝所有的非同步邏輯，元件只需透過 `const { data, isLoading } = useTransactions()` 取得結果。

### 4. Components 層 (The Presentation Layer)
- **檔案位置**: `features/[feature-name]/components/`
- **職責**: 
    - 負責 UI 呈現與 Ant Design 元件配置。
    - 處理使用者的直接互動（點擊、輸入）。
- **原則**: **盡可能保持「愚蠢」 (Dumb Components)**。如果一個元件內包含大量的 `data.map` 或複雜邏輯，應考慮移至 Service 層。

---

## 🔄 資料流向示意圖 (Data Flow)

API (原始資料) ➔ Services (DTO 轉換) ➔ Hooks (快取與狀態管理) ➔ Components (呈現 UI)