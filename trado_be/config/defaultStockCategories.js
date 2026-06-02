/**
 * 新使用者註冊時自動建立的預設族群
 * 取材自 Goodinfo / cnYES / 法人圈常用的台股「族群」(次產業) 口語分類
 *
 * 規則：純產業 / 次產業（不含規模、主題、配置角色）
 * color name 對應到前端 themePalette 的 slot
 */
export const DEFAULT_STOCK_CATEGORIES = [
  // 半導體
  { name: 'IC 設計',       color: 'blue' },
  { name: 'ASIC',          color: 'blue' },
  { name: '晶圓代工',      color: 'blue' },
  { name: '封測',          color: 'blue' },
  { name: '先進封裝',      color: 'blue' },
  { name: '設備',          color: 'blue' },
  { name: '廠務',          color: 'blue' },
  { name: '矽智財 IP',     color: 'blue' },
  { name: '第三代半導體',  color: 'blue' },

  // AI / 伺服器 / 光通訊
  { name: 'AI 伺服器',     color: 'indigo' },
  { name: 'CPO / 矽光子',  color: 'indigo' },
  { name: 'CoPoS',         color: 'indigo' },
  { name: '記憶體',        color: 'indigo' },
  { name: '網通',          color: 'indigo' },
  { name: '低軌衛星',      color: 'indigo' },

  // 電子零組件
  { name: '被動元件',      color: 'cyan' },
  { name: 'PCB',           color: 'cyan' },
  { name: 'ABF',           color: 'cyan' },
  { name: '連接器',        color: 'cyan' },
  { name: '光學',          color: 'cyan' },
  { name: '面板',          color: 'cyan' },
  { name: '機殼',          color: 'cyan' },
  { name: '散熱',          color: 'cyan' },
  { name: '組裝代工',      color: 'cyan' },

  // 金融
  { name: '金控',          color: 'yellow' },
  { name: '壽險',          color: 'yellow' },

  // 傳產
  { name: '鋼鐵',          color: 'orange' },
  { name: '塑化',          color: 'orange' },
  { name: '食品',          color: 'orange' },
  { name: '機械',          color: 'orange' },
  { name: '重電',          color: 'orange' },

  // 航運
  { name: '散裝航運',      color: 'pink' },
  { name: '貨櫃航',        color: 'pink' },
  { name: '航空',          color: 'pink' },

  // 綠能 / 車
  { name: '風電',          color: 'green' },
  { name: '太陽能',        color: 'green' },
  { name: '電動車',        color: 'green' },
  { name: '儲能',          color: 'green' },
  { name: '電池',          color: 'green' },

  // 生技 / 醫療 / 軍工 / 無人機 / 機器人 / 觀光
  { name: '生技',          color: 'purple' },
  { name: '醫材',          color: 'purple' },
  { name: '軍工',          color: 'purple' },
  { name: '無人機',        color: 'purple' },
  { name: '機器人',        color: 'purple' },
  { name: '觀光',          color: 'purple' },
];
