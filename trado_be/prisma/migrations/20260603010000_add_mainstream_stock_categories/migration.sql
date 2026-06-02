CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 補上 2025-2026 主流但缺漏的族群（同 user 已存在同名族群則略過）
-- sortOrder：接在每位使用者目前最大 sortOrder 之後依序遞增
INSERT INTO "StockCategory" (id, "userId", name, color, "sortOrder", "isStandby", "targetRatio", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  d.name,
  d.color,
  COALESCE(
    (SELECT MAX("sortOrder") FROM "StockCategory" WHERE "userId" = u.id),
    -1
  ) + d.idx,
  false,
  NULL,
  NOW(),
  NOW()
FROM "User" u
CROSS JOIN (VALUES
  ('ASIC',           'blue',   1),
  ('先進封裝',       'blue',   2),
  ('第三代半導體',   'blue',   3),
  ('連接器',         'cyan',   4),
  ('光學',           'cyan',   5),
  ('重電',           'orange', 6),
  ('儲能',           'green',  7),
  ('電池',           'green',  8),
  ('無人機',         'purple', 9),
  ('航空',           'pink',  10)
) AS d(name, color, idx)
WHERE NOT EXISTS (
  SELECT 1 FROM "StockCategory" sc
  WHERE sc."userId" = u.id AND sc.name = d.name
);
