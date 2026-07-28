-- Push automation schedule rules (when / how a template is auto-sent)
-- Used by /api/cron/wallet-welcome-expiry-push and Templates admin UI.

CREATE TABLE IF NOT EXISTS public.push_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.push_notification_templates(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'welcome_bonus_expiry',
  -- once_at_days: fire once when days_left = days_min (= days_max)
  -- daily_range: fire once per day when days_min <= days_left <= days_max
  schedule_mode TEXT NOT NULL
    CHECK (schedule_mode IN ('once_at_days', 'daily_range')),
  days_min INT NOT NULL CHECK (days_min >= 0 AND days_min <= 365),
  days_max INT NOT NULL CHECK (days_max >= 0 AND days_max <= 365),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_automation_rules_days_order CHECK (days_min <= days_max),
  CONSTRAINT push_automation_rules_template_unique UNIQUE (template_id)
);

CREATE INDEX IF NOT EXISTS idx_push_automation_rules_trigger_active
  ON public.push_automation_rules (trigger_type, is_active)
  WHERE is_active = true;

COMMENT ON TABLE public.push_automation_rules IS
  'Schedule for automated push templates (e.g. welcome bonus expiry: once at 15d, daily 0–7d).';

-- Seed rules for existing welcome-expiry templates (by stable name)
INSERT INTO public.push_automation_rules
  (template_id, trigger_type, schedule_mode, days_min, days_max, is_active)
SELECT t.id, 'welcome_bonus_expiry', 'once_at_days', 15, 15, true
FROM public.push_notification_templates t
WHERE t.name = 'Welcome Bonus Expiry D15'
ON CONFLICT (template_id) DO UPDATE SET
  schedule_mode = EXCLUDED.schedule_mode,
  days_min = EXCLUDED.days_min,
  days_max = EXCLUDED.days_max,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO public.push_automation_rules
  (template_id, trigger_type, schedule_mode, days_min, days_max, is_active)
SELECT t.id, 'welcome_bonus_expiry', 'daily_range', 2, 7, true
FROM public.push_notification_templates t
WHERE t.name = 'Welcome Bonus Expiry Daily'
ON CONFLICT (template_id) DO UPDATE SET
  schedule_mode = EXCLUDED.schedule_mode,
  days_min = EXCLUDED.days_min,
  days_max = EXCLUDED.days_max,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO public.push_automation_rules
  (template_id, trigger_type, schedule_mode, days_min, days_max, is_active)
SELECT t.id, 'welcome_bonus_expiry', 'once_at_days', 1, 1, true
FROM public.push_notification_templates t
WHERE t.name = 'Welcome Bonus Expiry Tomorrow'
ON CONFLICT (template_id) DO UPDATE SET
  schedule_mode = EXCLUDED.schedule_mode,
  days_min = EXCLUDED.days_min,
  days_max = EXCLUDED.days_max,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO public.push_automation_rules
  (template_id, trigger_type, schedule_mode, days_min, days_max, is_active)
SELECT t.id, 'welcome_bonus_expiry', 'once_at_days', 0, 0, true
FROM public.push_notification_templates t
WHERE t.name = 'Welcome Bonus Expiry Today'
ON CONFLICT (template_id) DO UPDATE SET
  schedule_mode = EXCLUDED.schedule_mode,
  days_min = EXCLUDED.days_min,
  days_max = EXCLUDED.days_max,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
