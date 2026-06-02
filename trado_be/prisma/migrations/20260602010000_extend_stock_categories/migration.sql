CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. Rename 半導體設備 → 設備（同 user 已經有「設備」則略過，避免 unique 衝突）
UPDATE "StockCategory" sc
SET name = '設備'
WHERE sc.name = '半導體設備'
  AND NOT EXISTS (
    SELECT 1 FROM "StockCategory" sc2
    WHERE sc2."userId" = sc."userId" AND sc2.name = '設備'
  );

-- ── 2. 補上新族群（同 user 已有同名族群則略過）
--   sortOrder：接在使用者目前最大 sortOrder 之後依序遞增
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
  ('ABF',           'cyan',     1),
  ('CoPoS',         'geekblue', 2),
  ('廠務',          'blue',     3),
  ('低軌衛星',      'geekblue', 4),
  ('機器人',        'purple',   5)
) AS d(name, color, idx)
WHERE NOT EXISTS (
  SELECT 1 FROM "StockCategory" sc
  WHERE sc."userId" = u.id AND sc.name = d.name
);
