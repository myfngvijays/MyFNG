-- WhatsApp automation triggers for membership claim approval flow
INSERT INTO public.whatsapp_automation_settings (
  trigger_key,
  display_name,
  description,
  template_name,
  template_body,
  variable_keys,
  is_enabled,
  cooldown_hours,
  phase
) VALUES
  (
    'membership_claim_submitted',
    'Membership Claim Submitted',
    'Sent to customer when a membership benefit claim is submitted for approval.',
    'membership_claim_submitted',
    E'Hi {{1}},\n\nYour MyFNG Prime benefit request has been received.\n\nBenefit: {{2}}\nCar: {{3}}\n\nOur team will review and confirm shortly on WhatsApp.',
    '["customer_name","benefit_title","vehicle"]'::jsonb,
    false,
    0,
    '1'
  ),
  (
    'membership_claim_approved',
    'Membership Claim Approved',
    'Sent to customer when admin approves a membership benefit claim.',
    'membership_claim_approved',
    E'Hi {{1}},\n\nGood news! Your MyFNG Prime benefit is approved.\n\nBenefit: {{2}}\nCar: {{3}}\nBooking: {{4}}\n\nOur team will contact you shortly.',
    '["customer_name","benefit_title","vehicle","booking_id"]'::jsonb,
    false,
    0,
    '1'
  ),
  (
    'membership_claim_rejected',
    'Membership Claim Rejected',
    'Sent to customer when admin rejects a membership benefit claim.',
    'membership_claim_rejected',
    E'Hi {{1}},\n\nYour MyFNG Prime benefit request could not be approved at this time.\n\nBenefit: {{2}}\nCar: {{3}}\n\nPlease contact support or try again from the app.',
    '["customer_name","benefit_title","vehicle"]'::jsonb,
    false,
    0,
    '1'
  )
ON CONFLICT (trigger_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  template_name = EXCLUDED.template_name,
  template_body = EXCLUDED.template_body,
  variable_keys = EXCLUDED.variable_keys;
