// 持股族群可用顏色（與後端 VALID_COLORS 同步；實際 hex 在 themePalette.js）
export const CATEGORY_COLORS = [
  'red', 'orange', 'yellow',
  'green', 'teal', 'cyan',
  'blue', 'indigo', 'purple',
  'pink', 'gray', 'slate',
];

export const MAX_CATEGORIES = 60;

// 推薦顏色：依現有族群「未使用過」的色票依序取
export const pickNextColor = (existingCategories = []) => {
  const used = new Set(existingCategories.map((c) => c.color));
  return CATEGORY_COLORS.find((c) => !used.has(c)) || CATEGORY_COLORS[0];
};
