-- ============================================================
-- 158: Coupon automation rules (triggers, conditions, actions)
-- Run after 156_coupon_management_enhancements.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.coupon_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type VARCHAR(40) NOT NULL,
  action_type VARCHAR(40) NOT NULL DEFAULT 'ASSIGN_COUPON',
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  run_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  template_key VARCHAR(60),
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_automations_active ON public.coupon_automations (is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_automations_trigger ON public.coupon_automations (trigger_type);

CREATE TABLE IF NOT EXISTS public.coupon_automation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES public.coupon_automations(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  message TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_automation_runs_automation ON public.coupon_automation_runs (automation_id, created_at DESC);

ALTER TABLE public.coupon_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_automation_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_automations'
      AND policyname = 'Super admins can manage coupon_automations'
  ) THEN
    CREATE POLICY "Super admins can manage coupon_automations"
      ON public.coupon_automations FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_automation_runs'
      AND policyname = 'Super admins can manage coupon_automation_runs'
  ) THEN
    CREATE POLICY "Super admins can manage coupon_automation_runs"
      ON public.coupon_automation_runs FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 158 applied: coupon automations & run history';
END $$;
