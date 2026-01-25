-- =====================================================
-- 122: lead_extra_charges - Mechanic work completion tracking
-- Purpose:
--  - Allow mechanics to mark an approved additional job as completed
--  - Store optional completion remark (similar to checklist remark)
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='work_completed'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN work_completed BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='work_completed_at'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN work_completed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='work_completed_by'
  ) THEN
    ALTER TABLE public.lead_extra_charges
      ADD COLUMN work_completed_by UUID REFERENCES public.users_login(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_extra_charges' AND column_name='work_completion_remark'
  ) THEN
    ALTER TABLE public.lead_extra_charges ADD COLUMN work_completion_remark TEXT;
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 122 applied: lead_extra_charges now tracks mechanic completion + remark';
END $$;

