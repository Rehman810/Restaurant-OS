-- Sync platform default trial length with product default (15 days).
UPDATE "PlatformSettings"
SET
  "data" = jsonb_set(COALESCE("data"::jsonb, '{}'::jsonb), '{trialDays}', '15'::jsonb, true),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'default'
  AND COALESCE(("data"->>'trialDays')::int, 14) = 14;
