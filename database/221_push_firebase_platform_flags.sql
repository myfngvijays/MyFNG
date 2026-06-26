-- 221_push_firebase_platform_flags.sql
ALTER TABLE public.push_firebase_config
  ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS android_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ios_enabled BOOLEAN NOT NULL DEFAULT true;

UPDATE public.push_firebase_config
SET project_name = 'MyFNG Production'
WHERE config_key = 'default' AND project_name = '';
