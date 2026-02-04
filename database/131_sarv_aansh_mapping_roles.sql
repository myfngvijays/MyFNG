-- =====================================================
-- Migration: SARV mapping roles (TELECALLER + RSA_MANAGER)
-- Purpose: Support mapping to multiple roles
-- =====================================================

-- 1) Add assignee role/user columns to mapping table
ALTER TABLE public.sarv_aansh_mappings
  ADD COLUMN IF NOT EXISTS assignee_role VARCHAR(30),
  ADD COLUMN IF NOT EXISTS assignee_id UUID;

-- Backfill for existing rows (telecaller_id -> assignee)
UPDATE public.sarv_aansh_mappings
SET assignee_role = 'TELECALLER',
    assignee_id = telecaller_id
WHERE assignee_role IS NULL;

ALTER TABLE public.sarv_aansh_mappings
  ALTER COLUMN assignee_role SET NOT NULL,
  ALTER COLUMN assignee_id SET NOT NULL;

ALTER TABLE public.sarv_aansh_mappings
  ADD CONSTRAINT sarv_aansh_mappings_assignee_role_check
  CHECK (assignee_role IN ('TELECALLER', 'RSA_MANAGER'));

CREATE INDEX IF NOT EXISTS idx_sarv_aansh_mappings_assignee
  ON public.sarv_aansh_mappings(assignee_id);

-- 2) Add assigned fields to sarv_calls
ALTER TABLE public.sarv_calls
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(30);

-- Backfill assigned fields for existing telecaller mapping
UPDATE public.sarv_calls
SET assigned_user_id = telecaller_id,
    assigned_role = 'TELECALLER'
WHERE assigned_user_id IS NULL AND telecaller_id IS NOT NULL;

ALTER TABLE public.sarv_calls
  ADD CONSTRAINT sarv_calls_assigned_role_check
  CHECK (assigned_role IS NULL OR assigned_role IN ('TELECALLER', 'RSA_MANAGER'));

CREATE INDEX IF NOT EXISTS idx_sarv_calls_assigned_user
  ON public.sarv_calls(assigned_user_id);

-- 3) Update RLS policies
DROP POLICY IF EXISTS "Telecallers can view their own sarv_calls" ON public.sarv_calls;
DROP POLICY IF EXISTS "Admins can manage sarv_calls" ON public.sarv_calls;
DROP POLICY IF EXISTS "Telecallers can view their sarv_call_rsa_links" ON public.sarv_call_rsa_links;
DROP POLICY IF EXISTS "Admins can manage sarv_call_rsa_links" ON public.sarv_call_rsa_links;

CREATE POLICY "Telecallers and RSA managers can view their own sarv_calls" ON public.sarv_calls
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code IN ('TELECALLER', 'RSA_MANAGER') AND sarv_calls.assigned_user_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
      )
  )
);

CREATE POLICY "Admins can manage sarv_calls" ON public.sarv_calls
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
  )
);

CREATE POLICY "Telecallers and RSA managers can view their sarv_call_rsa_links" ON public.sarv_call_rsa_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    JOIN public.sarv_calls sc ON sc.id = sarv_call_rsa_links.sarv_call_id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (
        (r.role_code IN ('TELECALLER', 'RSA_MANAGER') AND sc.assigned_user_id = ul.id)
        OR (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
      )
  )
);

CREATE POLICY "Admins can manage sarv_call_rsa_links" ON public.sarv_call_rsa_links
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' AND lower(ul.email) = lower(auth.jwt() ->> 'email'))
        OR (coalesce(auth.jwt() ->> 'phone', '') <> '' AND ul.phone = (auth.jwt() ->> 'phone'))
        OR (ul.id = auth.uid())
      )
      AND (r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN'))
  )
);

DO $$
BEGIN
  RAISE NOTICE '✅ SARV mapping roles updated (TELECALLER + RSA_MANAGER)';
END $$;
