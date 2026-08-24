-- Cart abandoned + workshop proximity templates were inserted as drafts (is_active=false).
-- Sync previously preserved that flag even after Meta APPROVED, so Send Test skipped with
-- template_not_approved while the admin UI still showed Live (Meta verify path).
BEGIN;

UPDATE public.whatsapp_templates
SET
  is_active = true,
  category = COALESCE(NULLIF(UPPER(TRIM(category)), ''), 'UTILITY'),
  meta = COALESCE(meta, '{}'::jsonb)
    || jsonb_build_object(
      'status',
      COALESCE(NULLIF(UPPER(TRIM(meta->>'status')), ''), 'APPROVED')
    ),
  updated_at = NOW()
WHERE template_name IN (
  'workshop_proximity_alert',
  'cart_abandoned_reminder_1',
  'cart_abandoned_reminder_2',
  'cart_abandoned_reminder_3'
);

COMMIT;
