-- Telecaller closed-window: only quick_note_with_button (OK). Plain myfng_quick_note off.
-- Run after 401_quick_note_with_button.sql; Push + Sync quick_note_with_button in admin.

UPDATE public.whatsapp_templates
SET
  is_active = false,
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('crm_telecaller', false),
  updated_at = NOW()
WHERE template_name = 'myfng_quick_note';

UPDATE public.whatsapp_templates
SET
  is_active = true,
  meta = COALESCE(meta, '{}'::jsonb)
    || jsonb_build_object('crm_telecaller', true, 'frictionless', true, 'opens_session', true),
  updated_at = NOW()
WHERE template_name = 'quick_note_with_button';