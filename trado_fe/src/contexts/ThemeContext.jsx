import React, { createContext, useContext, useState, useEffect } from 'react'
import { colorThemes, defaultTheme } from '@/config/colorThemes'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // 從 localStorage 讀取保存的主題
    const saved = localStorage.getItem('colorTheme')
    return saved && colorThemes[saved] ? saved : defaultTheme
  })

  const theme = colorThemes[currentTheme] || colorThemes[defaultTheme]

  const changeTheme = (themeKey) => {
    if (colorThemes[themeKey]) {
      setCurrentTheme(themeKey)
      localStorage.setItem('colorTheme', themeKey)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
