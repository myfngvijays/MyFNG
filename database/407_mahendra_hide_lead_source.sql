-- Mahendra (click-to-call DID owner): hide WhatsApp / Meta / channel in "Lead from" on web + app.
-- Permission: view_lead_source = false (API uses leadSourceTagWithoutChannel).

INSERT INTO public.telecaller_permission_templates (name, description, permissions, is_default, is_active)
SELECT
  'Mahendra — no lead source',
  'Lead from column hidden; no WhatsApp number / ads channel on list (booking pending pill only).',
  jsonb_build_object('view_lead_source', false),
  false,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.telecaller_permission_templates
  WHERE lower(name) = lower('Mahendra — no lead source')
);

UPDATE public.users_login u
SET
  crm_permission_template_id = t.id,
  updated_at = NOW()
FROM public.telecaller_permission_templates t
WHERE lower(t.name) = lower('Mahendra — no lead source')
  AND (
    lower(coalesce(u.full_name, '')) LIKE '%mahendra%'
    OR right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10) = '9594050288'
    OR lower(coalesce(u.email, '')) LIKE '%mahendra%'
  );