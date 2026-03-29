// 主題配置
export const lightTheme = {
  // 色彩系統
  colors: {
    // 主要色彩
    primary: '#1890ff',
    primaryHover: '#40a9ff',
    primaryActive: '#096dd9',
    
    // 背景色彩
    background: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    backgroundTertiary: '#fafafa',
    
    // 文字色彩
    text: '#000000',
    textSecondary: '#666666',
    textDisabled: '#999999',
    
    // 邊框色彩
    border: '#d9d9d9',
    borderLight: '#f0f0f0',
    
    // 狀態色彩
    success: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
    info: '#1890ff',
    
    // 陰影色彩
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowLight: 'rgba(0, 0, 0, 0.05)',
  },
  
  // 組件特定色彩
  components: {
    sidebar: {
      background: '#001529',
      text: '#ffffff',
      textSecondary: '#8c8c8c',
      border: 'rgba(255, 255, 255, 0.1)',
      hover: '#1890ff',
      active: '#1890ff',
      activeIndicator: '#52c41a',
    },
    
    card: {
      background: '#ffffff',
      border: '#f0f0f0',
      shadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    },
    
    button: {
      background: '#ffffff',
      border: '#d9d9d9',
      text: '#000000',
      hover: '#f5f5f5',
    }
  }
};

export const darkTheme = {
  // 色彩系統
  colors: {
    // 主要色彩
    primary: '#177ddc',
    primaryHover: '#1890ff',
    primaryActive: '#0958b5',
    
    // 背景色彩
    background: '#141414',
    backgroundSecondary: '#1f1f1f',
    backgroundTertiary: '#262626',
    
    // 文字色彩
    text: '#ffffff',
    textSecondary: '#a6a6a6',
    textDisabled: '#595959',
    
    // 邊框色彩
    border: '#434343',
    borderLight: '#303030',
    
    // 狀態色彩
    success: '#49aa19',
    warning: '#d89614',
    error: '#d32029',
    info: '#177ddc',
    
    // 陰影色彩
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowLight: 'rgba(0, 0, 0, 0.2)',
  },
  
  // 組件特定色彩
  components: {
    sidebar: {
      background: '#001529',
      text: '#ffffff',
      textSecondary: '#8c8c8c',
      border: 'rgba(255, 255, 255, 0.1)',
      hover: '#177ddc',
      active: '#177ddc',
      activeIndicator: '#49aa19',
    },
    
    card: {
      background: '#1f1f1f',
      border: '#434343',
      shadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    },
    
    button: {
      background: '#262626',
      border: '#434343',
      text: '#ffffff',
      hover: '#1f1f1f',
    }
  }
};

// 主題類型
export const THEME_TYPES = {
  LIGHT: 'light',
  DARK: 'dark',
};

// 預設主題
export const DEFAULT_THEME = THEME_TYPES.LIGHT;