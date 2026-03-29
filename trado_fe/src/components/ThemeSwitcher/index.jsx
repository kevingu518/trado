import React, { useState } from 'react'
import { Popover, Button } from 'antd'
import { BgColorsOutlined } from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'
import { colorThemes } from '@/config/colorThemes'
import './index.scss'

const ThemeSwitcher = () => {
  const { currentTheme, changeTheme } = useTheme()
  const [visible, setVisible] = useState(false)

  const handleThemeChange = (themeKey) => {
    changeTheme(themeKey)
    setVisible(false)
  }

  const content = (
    <div className="theme-switcher-content">
      <div className="theme-colors-grid">
        {Object.entries(colorThemes).map(([key, theme]) => (
          <button
            key={key}
            className={`theme-color-item ${currentTheme === key ? 'active' : ''}`}
            onClick={() => handleThemeChange(key)}
            style={{
              background: theme.gradient,
              border: currentTheme === key ? '3px solid #fff' : '2px solid rgba(255, 255, 255, 0.3)',
            }}
            title={theme.name}
          >
            {currentTheme === key && <span className="check-icon">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      title="選擇主題顏色"
      placement="rightBottom"
      open={visible}
      onOpenChange={setVisible}
    >
      <Button
        type="text"
        // icon={<BgColorsOutlined />}
        className="theme-switcher-btn"
        title="切換主題顏色"
        style={{
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BgColorsOutlined />
      </Button>
    </Popover>
  )
}

export default ThemeSwitcher
