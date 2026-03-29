// 主題顏色配置
export const colorThemes = {
  red: {
    name: '紅色',
    primary: '#c92a2a',        // 主紅：偏沈穩一點
    primaryDark: '#801515',    // 深紅：做 hover / active
    primaryLight: '#f08c8c',   // 淡紅：用在較大面積背景
    gradient: 'linear-gradient(135deg, #801515 0%, #c92a2a 45%, #f08c8c 100%)',
  },
  orange: {
    name: '橙色',
    // 加深一階的焦糖橘，讓格子對比更明顯
    primary: '#d66a1c',        // 主色：比原本更深
    primaryDark: '#9b4610',    // 深色：hover / active
    primaryLight: '#f29b4f',   // 淺色：保留一點亮度
    // 深 → 主 → 淺，結構跟藍色一致
    gradient: 'linear-gradient(135deg, #9b4610 0%, #d66a1c 50%, #f29b4f 100%)',
  },
  // yellow: {
  //   name: '黃色',
  //   // 新一組：偏琥珀金黃，比較穩、不螢光
  //   primary: '#eab308',
  //   primaryDark: '#b45309',
  //   primaryLight: '#facc6b',
  //   gradient: 'linear-gradient(135deg,rgb(224, 193, 16) 0%,rgb(234, 189, 8) 50%,rgb(250, 231, 107) 100%)',
  // },
  green: {
    name: '綠色',
    primary: '#3f8f4e',
    primaryDark: '#256333',
    primaryLight: '#8fd3a0',
    gradient: 'linear-gradient(135deg, #256333 0%, #3f8f4e 45%, #8fd3a0 100%)',
  },
  teal: {
    name: '青綠',
    // 介於藍色與綠色之間的清爽色，搭你的格子背景也不會太跳
    primary: '#0f766e',
    primaryDark: '#115e59',
    primaryLight: '#5eead4',
    gradient: 'linear-gradient(135deg, #115e59 0%, #0f766e 50%,rgb(45, 213, 188) 100%)',
  },
  blue: {
    name: '藍色',
    primary: '#2a5298',
    primaryDark: '#1e3c72',
    primaryLight: '#7e8ba3',
    gradient: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e8ba3 100%)',
  },
  purple: {
    name: '紫色',
    // 偏一點麥芽金，搭灰底不會太亮
    primary: '#5c4b86',
    primaryDark: '#7a6fa8',
    primaryLight: '#b1a8d9',
    gradient: 'linear-gradient(135deg, #5c4b86 0%, #7a6fa8 50%, #b1a8d9 100%)'
    ,
  },
  gray: {
    name: '灰色',
    primary: '#595959',
    primaryDark: '#434343',
    primaryLight: '#8c8c8c',
    gradient: 'linear-gradient(135deg, #434343 0%, #595959 50%, #8c8c8c 100%)',
  },
  black: {
    name: '黑色',
    primary: '#262626',
    primaryDark: '#141414',
    primaryLight: '#595959',
    gradient: 'linear-gradient(135deg, #141414 0%, #262626 50%, #595959 100%)',
  },
}

export const defaultTheme = 'blue'
