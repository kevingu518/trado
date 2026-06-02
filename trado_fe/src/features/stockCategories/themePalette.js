/**
 * 族群色票 — 12 色 curated palette
 *
 * 設計原則：
 *  - 色相分布廣（紅 / 橘 / 黃 / 綠 / 青 / 藍 / 靛 / 紫 / 粉 + 中性灰 / 黑）
 *  - 飽和度跟明度刻意對齊（Tailwind 500 系列為基底，微調）
 *  - 適合 Tag 「淺底 + 同色邊框 + 同色文字」風格
 *
 * DB 內存的是 color name（slot key），實際顏色由這裡定義；
 * 未來想換 palette 不需要動 DB。
 */

export const COLOR_NAMES = [
  'red', 'orange', 'yellow',
  'green', 'teal', 'cyan',
  'blue', 'indigo', 'purple',
  'pink', 'gray', 'slate',
];

export const COLOR_PALETTE = {
  red:    '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green:  '#22c55e',
  teal:   '#14b8a6',
  cyan:   '#06b6d4',
  blue:   '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  pink:   '#ec4899',
  gray:   '#6b7280',
  slate:  '#334155',  // 近黑，做為「深色 / 中性」slot
};

/**
 * 取得 Tag 三層樣式：淺色底 + 同色邊 + 同色字
 */
export function getTagStyleFromHex(hex) {
  return {
    background: `${hex}1a`,      // 10% alpha bg
    borderColor: `${hex}66`,     // 40% alpha border
    color: hex,
  };
}

/**
 * 容錯：若取到不認識的 color name，fallback 到 gray
 */
export function getHex(name) {
  return COLOR_PALETTE[name] || COLOR_PALETTE.gray;
}
