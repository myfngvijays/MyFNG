-- Telecaller leads shift report — WhatsApp UTILITY template (system alert numbers only).
-- After migrate: Super Admin → WhatsApp Cron → Create / Sync on Meta → wait APPROVED.
-- Body vars: {{1}} shift window, {{2}} single-line "Name - N | Name - N" (no total).

BEGIN;

INSERT INTO public.whatsapp_templates (
  template_name,
  display_name,
  language_code,
  category,
  body_text,
  variable_keys,
  example_values,
  is_active,
  meta,
  created_at,
  updated_at
) VALUES (
  'telecaller_leads_shift_report',
  'Telecaller Leads Shift Report',
  'en',
  'UTILITY',
  E'MyFNG telecaller lead report\n\nShift window: {{1}}\nAssigned lead counts: {{2}}\n\nThis is an automated account notification for MyFNG administrators.',
  '["shift_window","lead_counts"]'::jsonb,
  '["19 Aug 7:00 pm to 20 Aug 7:00 pm IST","Vijay Tele - 14 | Rahul - 8 | Unassigned - 2"]'::jsonb,
  false,
  jsonb_build_object(
    'purpose', 'telecaller_leads_shift_summary',
    'source', 'local_draft',
    'recipients', 'system_alert_whatsapp_numbers',
    'meta_submit_note', 'UTILITY — daily 7pm IST TC lead counts to system alert WhatsApp numbers only.'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  language_code = EXCLUDED.language_code,
  category = EXCLUDED.category,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  meta = COALESCE(public.whatsapp_templates.meta, '{}'::jsonb) || EXCLUDED.meta,
  updated_at = NOW();

COMMIT;
