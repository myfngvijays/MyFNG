-- Telecaller chat lists ONLY templates with meta.crm_telecaller = true.
-- Keep Quick note ON; turn OFF older closed-window notes + CRM Hello for telecallers.
--
-- Run in Supabase SQL → reopen WhatsApp chat on phone (pull to refresh / kill app).

UPDATE public.whatsapp_templates
SET
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('crm_telecaller', true, 'frictionless', true),
  is_active = true,
  updated_at = NOW()
WHERE template_name = 'myfng_quick_note';

UPDATE public.whatsapp_templates
SET
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('crm_telecaller', false),
  updated_at = NOW()
WHERE template_name IN (
  'myfng_closed_window_note',
  'myfng_support_note',
  'myfng_msg_note',
  'myfng_msg_note_safe',
  'myfng_frictionless_chat',
  'crm_hello'
);
