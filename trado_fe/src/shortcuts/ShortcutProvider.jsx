import React, { useState } from 'react'
import { ShortcutSettingsProvider } from './ShortcutSettingsContext'
import { useShortcut } from './useShortcut'
import ShortcutHelpModal from './ShortcutHelpModal'

// 內層：負責註冊全域快捷鍵 + 渲染說明 Modal
// 拆出來是因為 useShortcut 必須在 ShortcutSettingsProvider 內部呼叫
const GlobalShortcuts = ({ children }) => {
  const [helpOpen, setHelpOpen] = useState(false)

  useShortcut('help', () => setHelpOpen((v) => !v))

  // Esc：取消目前 focus；enableOnFormTags 必須開，否則在 input 裡按沒效
  // preventDefault 設 false，讓 Antd Modal/Drawer 的內建 Esc 關閉行為不被擋
  useShortcut(
    'blur',
    () => {
      const active = document.activeElement
      if (active && active !== document.body && typeof active.blur === 'function') {
        active.blur()
      }
    },
    { enableOnFormTags: true, preventDefault: false },
  )

  return (
    <>
      {children}
      <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}

const ShortcutProvider = ({ children }) => (
  <ShortcutSettingsProvider>
    <GlobalShortcuts>{children}</GlobalShortcuts>
  </ShortcutSettingsProvider>
)

export default ShortcutProvider
