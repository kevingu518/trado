/**
 * 族群色票 — 12 色 curated palette
 *
 * 設計原則：
 *  - 色相分布廣（紅 / 橘 / 黃 / 綠 / 青 / 藍 / 靛 / 紫 / 粉 + 中性灰 / 黑）
 *  - 飽和度與明度對齊 colorThemes.js 的沉穩 desaturated 調性
 *    （HSL 大多落在 S=45–60% / L=40–48%）
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
  red:    '#c0413a',  // 沉穩磚紅（呼應主題 red #c92a2a）
  orange: '#c95f1f',  // 焦糖橘
  yellow: '#b88a1f',  // 琥珀芥末（避免螢光黃）
  green:  '#3f8f4e',  // 同主題 green
  teal:   '#1d8079',  // 暗青綠（呼應主題 teal #0f766e）
  cyan:   '#2c7da3',  // 灰青
  blue:   '#3d6bb3',  // 同主題 blue 家族
  indigo: '#5a55b8',  // 灰靛
  purple: '#7857c2',  // 灰紫（呼應主題 purple #5c4b86）
  pink:   '#b85285',  // 玫瑰
  gray:   '#6b7280',  // 中性灰
  slate:  '#3f4e63',  // 深灰藍，做為「深色 / 中性」slot
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
