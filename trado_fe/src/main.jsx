import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import 'react-perfect-scrollbar/dist/css/styles.css'
import zhTW from 'antd/locale/zh_TW'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { showInsetEffect } from './utils/insetEffect'
import './styles/index.scss'
import App from './App.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// 將顏色轉換為 rgba 格式的輔助函數
const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 內部組件，使用主題
const ThemedApp = () => {
  const { theme } = useTheme()
  
  return (
    <ConfigProvider
      locale={zhTW}
      wave={{
        showEffect: showInsetEffect,
      }}
      theme={{
        token: {
          // 主要顏色（使用動態主題）
          colorPrimary: theme.primary,
          colorPrimaryHover: theme.primaryDark,
          colorPrimaryActive: theme.primaryDark,
          colorPrimaryBg: hexToRgba(theme.primary, 0.1),
          colorPrimaryBgHover: hexToRgba(theme.primary, 0.15),
          colorPrimaryBorder: hexToRgba(theme.primary, 0.3),
          colorPrimaryBorderHover: hexToRgba(theme.primaryDark, 0.5),
          
          // 其他狀態顏色
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          colorInfo: theme.primary, // 使用主色調
          
          // 邊框顏色（使用主題色）
          colorBorder: hexToRgba(theme.primaryDark, 0.2),
          colorBorderSecondary: hexToRgba(theme.primaryDark, 0.1),
          
          // 背景顏色
          colorBgContainer: '#ffffff',
          // colorBgElevated: 'rgba(255, 255, 255, 0.95)',
          colorBgLayout: '#f5f5f5',
          
          // 文字顏色
          colorText: '#1a1a1a',
          colorTextSecondary: '#666666',
          colorTextTertiary: '#999999',
          
          // 圓角（與 login 頁面風格一致）
          borderRadius: 8,
          borderRadiusLG: 8,
          borderRadiusSM: 4,
          
          // 陰影
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          boxShadowSecondary: '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
        // 組件特定配置
        components: {
          Button: {
            borderRadius: 8,
            primaryShadow: `0 4px 12px ${hexToRgba(theme.primaryDark, 0.3)}`,
            defaultShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          },
          Input: {
            borderRadius: 8,
            activeBorderColor: theme.primary,
            hoverBorderColor: theme.primaryDark,
          },
          Select: {
            borderRadius: 8,
            optionSelectedBg: hexToRgba(theme.primary, 0.1),
            optionActiveBg: hexToRgba(theme.primary, 0.15),
            optionSelectedColor: theme.primary,
            activeBorderColor: theme.primary,
            hoverBorderColor: theme.primary,
          },
          DatePicker: {
            borderRadius: 8,
            activeBorderColor: theme.primary,
            hoverBorderColor: theme.primary,
          },
          Table: {
            borderRadius: 8,
            headerBg: 'rgba(250, 250, 250, 0.9)',
            headerColor: '#1a1a1a',
            rowHoverBg: hexToRgba(theme.primary, 0.05),
          },
          Card: {
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          },
          Tag: {
            borderRadius: 4,
          },
          Modal: {
            borderRadius: 16,
          },
          Drawer: {
            borderRadius: 16,
          },
        },
      }}
    >
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </ConfigProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </StrictMode>,
)
