-- 確保有 gen_random_uuid()（先前 migration 可能已啟用，這裡再保險一次）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 為每位現有使用者補滿預設族群（已存在的同名族群不會被覆蓋）
-- 預設清單需與 trado_be/config/defaultStockCategories.js 保持同步
INSERT INTO "StockCategory" (id, "userId", name, color, "sortOrder", "isStandby", "targetRatio", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  d.name,
  d.color,
  d.sort_order,
  false,
  NULL,
  NOW(),
  NOW()
FROM "User" u
CROSS JOIN (VALUES
  -- 半導體
  ('IC 設計',       'blue',     0),
  ('晶圓代工',      'blue',     1),
  ('封測',          'blue',     2),
  ('半導體設備',    'blue',     3),
  ('矽智財 IP',     'blue',     4),
  -- AI / 伺服器 / 光通訊
  ('AI 伺服器',     'geekblue', 5),
  ('CPO / 矽光子',  'geekblue', 6),
  ('記憶體',        'geekblue', 7),
  ('網通',          'geekblue', 8),
  -- 電子零組件
  ('被動元件',      'cyan',     9),
  ('PCB',           'cyan',    10),
  ('面板',          'cyan',    11),
  ('機殼',          'cyan',    12),
  ('散熱',          'cyan',    13),
  ('組裝代工',      'cyan',    14),
  -- 金融
  ('金控',          'gold',    15),
  ('壽險',          'gold',    16),
  -- 傳產
  ('鋼鐵',          'orange',  17),
  ('塑化',          'orange',  18),
  ('食品',          'orange',  19),
  ('機械',          'orange',  20),
  -- 航運
  ('散裝航運',      'magenta', 21),
  ('貨櫃航',        'magenta', 22),
  -- 綠能 / 車
  ('風電',          'green',   23),
  ('太陽能',        'green',   24),
  ('電動車',        'green',   25),
  -- 生技 / 醫材 / 軍工 / 觀光
  ('生技',          'purple',  26),
  ('醫材',          'purple',  27),
  ('軍工',          'purple',  28),
  ('觀光',          'purple',  29)
) AS d(name, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "StockCategory" sc
  WHERE sc."userId" = u.id AND sc.name = d.name
);
