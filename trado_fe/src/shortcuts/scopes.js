// 快捷鍵作用域：用於管理頁面分組顯示與分組啟用/停用
export const SCOPE = {
  GLOBAL: 'global',
  TRADES: 'trades',
  STRATEGY: 'strategy',
  DASHBOARD: 'dashboard',
}

export const SCOPE_LABELS = {
  [SCOPE.GLOBAL]: '全域',
  [SCOPE.TRADES]: '交易頁',
  [SCOPE.STRATEGY]: '策略頁',
  [SCOPE.DASHBOARD]: '儀表板',
}
