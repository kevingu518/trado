// 持股族群可用顏色（與後端 VALID_COLORS 同步）
export const CATEGORY_COLORS = [
  'red', 'orange', 'gold', 'lime', 'green',
  'cyan', 'blue', 'geekblue', 'purple', 'magenta',
];

export const MAX_CATEGORIES = 30;

// 推薦顏色：依現有族群「未使用過」的色票依序取
export const pickNextColor = (existingCategories = []) => {
  const used = new Set(existingCategories.map((c) => c.color));
  return CATEGORY_COLORS.find((c) => !used.has(c)) || CATEGORY_COLORS[0];
};

// 各族群分組（純 UI 顯示用，後端不存）
export const PRESET_GROUPS = [
  '半導體',
  'AI / 伺服器 / 光通訊',
  '電子零組件',
  '金融',
  '傳產',
  '航運 / 運輸',
  '能源 / 綠能',
  '其他',
];

// 推薦色票：同一組用相近色系，方便視覺辨識
const G = {
  semiconductor: 'blue',
  ai: 'geekblue',
  components: 'cyan',
  finance: 'gold',
  traditional: 'orange',
  shipping: 'magenta',
  energy: 'green',
  other: 'purple',
};

/**
 * 第一次使用時的預設族群清單
 * - defaultChecked: 是否預先打勾
 * - color: 建議顏色（建立時可改）
 */
export const PRESET_CATEGORIES = [
  // 半導體
  { name: 'IC 設計',       group: '半導體', color: G.semiconductor, defaultChecked: true },
  { name: '晶圓代工',      group: '半導體', color: G.semiconductor, defaultChecked: true },
  { name: '封測',          group: '半導體', color: G.semiconductor, defaultChecked: true },
  { name: '半導體設備',    group: '半導體', color: G.semiconductor, defaultChecked: true },
  { name: '矽智財 IP',     group: '半導體', color: G.semiconductor, defaultChecked: true },

  // AI / 伺服器 / 光通訊
  { name: 'AI 伺服器',     group: 'AI / 伺服器 / 光通訊', color: G.ai, defaultChecked: true },
  { name: 'CPO / 矽光子',  group: 'AI / 伺服器 / 光通訊', color: G.ai, defaultChecked: true },
  { name: '記憶體',        group: 'AI / 伺服器 / 光通訊', color: G.ai, defaultChecked: false },
  { name: '光通訊',        group: 'AI / 伺服器 / 光通訊', color: G.ai, defaultChecked: false },
  { name: '網通',          group: 'AI / 伺服器 / 光通訊', color: G.ai, defaultChecked: false },

  // 電子零組件
  { name: '被動元件',      group: '電子零組件', color: G.components, defaultChecked: false },
  { name: 'PCB',           group: '電子零組件', color: G.components, defaultChecked: false },
  { name: '面板',          group: '電子零組件', color: G.components, defaultChecked: false },
  { name: '連接器',        group: '電子零組件', color: G.components, defaultChecked: false },
  { name: '機殼',          group: '電子零組件', color: G.components, defaultChecked: false },
  { name: '散熱',          group: '電子零組件', color: G.components, defaultChecked: false },
  { name: '組裝代工',      group: '電子零組件', color: G.components, defaultChecked: false },

  // 金融
  { name: '金控',          group: '金融', color: G.finance, defaultChecked: true },
  { name: '證券',          group: '金融', color: G.finance, defaultChecked: false },
  { name: '壽險',          group: '金融', color: G.finance, defaultChecked: false },

  // 傳產
  { name: '鋼鐵',          group: '傳產', color: G.traditional, defaultChecked: true },
  { name: '塑化',          group: '傳產', color: G.traditional, defaultChecked: false },
  { name: '紡織',          group: '傳產', color: G.traditional, defaultChecked: false },
  { name: '食品',          group: '傳產', color: G.traditional, defaultChecked: false },
  { name: '水泥',          group: '傳產', color: G.traditional, defaultChecked: false },
  { name: '造紙',          group: '傳產', color: G.traditional, defaultChecked: false },
  { name: '玻璃',          group: '傳產', color: G.traditional, defaultChecked: false },
  { name: '機械',          group: '傳產', color: G.traditional, defaultChecked: false },

  // 航運 / 運輸
  { name: '散裝航運',      group: '航運 / 運輸', color: G.shipping, defaultChecked: true },
  { name: '貨櫃航',        group: '航運 / 運輸', color: G.shipping, defaultChecked: true },
  { name: '航空',          group: '航運 / 運輸', color: G.shipping, defaultChecked: false },

  // 能源 / 綠能
  { name: '重電',          group: '能源 / 綠能', color: G.energy, defaultChecked: false },
  { name: '風電',          group: '能源 / 綠能', color: G.energy, defaultChecked: false },
  { name: '太陽能',        group: '能源 / 綠能', color: G.energy, defaultChecked: false },
  { name: '儲能',          group: '能源 / 綠能', color: G.energy, defaultChecked: false },

  // 其他
  { name: '生技',          group: '其他', color: G.other, defaultChecked: false },
  { name: '醫材',          group: '其他', color: G.other, defaultChecked: false },
  { name: '觀光',          group: '其他', color: G.other, defaultChecked: false },
  { name: '營建',          group: '其他', color: G.other, defaultChecked: false },
];
