import { SCOPE } from './scopes'

// 所有快捷鍵的 single source of truth
// useShortcut(id, callback) 會從這裡查 keys；ShortcutHelpModal 與管理頁面也讀這份資料
export const SHORTCUT_REGISTRY = [
  // 全域
  // 注意：搭配 useKey:true，符號鍵直接寫實際字元（'?' 是 Shift+/ 產生的 e.key）
  { id: 'help', keys: '?', display: '?', scope: SCOPE.GLOBAL, description: '顯示快捷鍵說明' },
  { id: 'blur', keys: 'escape', display: 'Esc', scope: SCOPE.GLOBAL, description: '取消輸入框 focus' },

  // 交易頁
  { id: 'trades-new', keys: 'n', display: 'N', scope: SCOPE.TRADES, description: '新增交易（開單）' },
  { id: 'trades-search', keys: '/', display: '/', scope: SCOPE.TRADES, description: 'Focus 股號搜尋' },
  { id: 'trades-reset', keys: 'r', display: 'R', scope: SCOPE.TRADES, description: '清除所有過濾條件' },
  { id: 'trades-status-cycle', keys: 's', display: 'S', scope: SCOPE.TRADES, description: '切換交易狀態（全部 / 持倉中 / 已清倉）' },
  { id: 'trades-row-up', keys: 'up', display: '↑', scope: SCOPE.TRADES, description: '焦點移到上一筆' },
  { id: 'trades-row-down', keys: 'down', display: '↓', scope: SCOPE.TRADES, description: '焦點移到下一筆' },
  { id: 'trades-row-first', keys: 'pageup', display: 'fn+↑', scope: SCOPE.TRADES, description: '焦點移到當前頁第一筆' },
  { id: 'trades-row-last', keys: 'pagedown', display: 'fn+↓', scope: SCOPE.TRADES, description: '焦點移到當前頁最後一筆' },
  { id: 'trades-row-open', keys: 'enter', display: 'Enter', scope: SCOPE.TRADES, description: '開啟焦點記錄的詳細抽屜' },
]

export const REGISTRY_BY_ID = SHORTCUT_REGISTRY.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

export const getShortcutById = (id) => REGISTRY_BY_ID[id]

export const getShortcutsByScope = (scope) =>
  SHORTCUT_REGISTRY.filter((s) => s.scope === scope)
