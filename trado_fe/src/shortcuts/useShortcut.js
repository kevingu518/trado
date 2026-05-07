import { useHotkeys } from 'react-hotkeys-hook'
import { getShortcutById } from './shortcutRegistry'
import { useShortcutSettings } from './ShortcutSettingsContext'

// 包裝 react-hotkeys-hook，自動：
//   1. 從 registry 查 keys（id 是 single source of truth）
//   2. 套用使用者在管理頁面的啟用設定
//   3. 預設 enableOnFormTags: false（input/textarea 中不觸發），但可被 options 覆蓋
//
// 用法：useShortcut('trades-new', () => handleAdd())
export function useShortcut(id, callback, options = {}) {
  const { isShortcutEnabled } = useShortcutSettings()
  const entry = getShortcutById(id)

  if (!entry) {
    throw new Error(`[useShortcut] unknown shortcut id: ${id}. Add it to shortcutRegistry.js first.`)
  }

  const { enabled: enabledOverride = true, deps = [], ...rest } = options

  return useHotkeys(
    entry.keys,
    callback,
    {
      enabled: enabledOverride && isShortcutEnabled(entry.scope),
      enableOnFormTags: false,
      preventDefault: true,
      // 使用 e.key（實際輸入字元）做匹配，否則符號鍵如 '/'、'?' 會因為被
      // 預設的 e.code 路徑（'Slash'）正規化掉而比對失敗而無法觸發
      useKey: true,
      ...rest,
    },
    deps,
  )
}
