-- Rewrite automation templates with UTILITY-safe copy + new Meta template names.
-- Meta often reclassifies promotional/re-engagement wording as MARKETING even when submitted as UTILITY.

BEGIN;

UPDATE public.whatsapp_automation_settings
SET
  template_name = 'service_due_account_update',
  template_body = E'Hi {{1}},\n\nAccount update for your vehicle {{2}} ({{3}}).\n\nLast service date: {{4}}\nService status: Periodic service is due on your MyFNG account.\n\nThis is an automated account notification.\n\nThank you.',
  updated_at = NOW()
WHERE trigger_key = 'service_due_reminder';

UPDATE public.whatsapp_automation_settings
SET
  template_name = 'account_session_update',
  template_body = E'Hi {{1}},\n\nAccount update: your recent MyFNG app session ended before an action was completed.\n\nIf you need assistance with your account or booking, reply to this message.\n\nThis is an automated account notification.\n\nThank you.',
  updated_at = NOW()
WHERE trigger_key = 'app_session_incomplete';

UPDATE public.whatsapp_automation_settings
SET
  template_name = 'membership_expiry_account_update',
  template_body = E'Hi {{1}},\n\nYour MyFNG Prime membership expiry date is {{2}}.\n\nThis is an automated account notification about your active membership status.\n\nThank you.',
  updated_at = NOW()
WHERE trigger_key = 'membership_expiring';

COMMIT;
