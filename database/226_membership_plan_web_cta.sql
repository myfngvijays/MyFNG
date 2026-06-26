-- Website visibility + admin-configurable CTA for membership plan cards
ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS web_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS web_cta_action VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS web_cta_label VARCHAR(200) NOT NULL DEFAULT 'Add to Cart — {price} →',
  ADD COLUMN IF NOT EXISTS web_cta_whatsapp_phone VARCHAR(20) NOT NULL DEFAULT '919167779696',
  ADD COLUMN IF NOT EXISTS web_cta_whatsapp_message TEXT NOT NULL DEFAULT 'Hi I am interested in RSA Membership {plan_name} Plan',
  ADD COLUMN IF NOT EXISTS web_cta_url TEXT;

COMMENT ON COLUMN membership_plans.web_visible IS 'Show plan on website (e.g. RSA landing page)';
COMMENT ON COLUMN membership_plans.web_cta_action IS 'whatsapp | cart | link';
COMMENT ON COLUMN membership_plans.web_cta_label IS 'Button label; placeholders: {plan_name}, {price}, {price_inr}';
COMMENT ON COLUMN membership_plans.web_cta_whatsapp_phone IS 'WhatsApp number with country code, no + sign';
COMMENT ON COLUMN membership_plans.web_cta_whatsapp_message IS 'Prefilled WhatsApp text; placeholders: {plan_name}, {price}, {price_inr}';

UPDATE membership_plans
SET
  web_visible = TRUE,
  web_cta_action = 'whatsapp',
  web_cta_label = COALESCE(NULLIF(TRIM(web_cta_label), ''), 'Add to Cart — {price} →'),
  web_cta_whatsapp_phone = COALESCE(NULLIF(TRIM(web_cta_whatsapp_phone), ''), '919167779696'),
  web_cta_whatsapp_message = COALESCE(
    NULLIF(TRIM(web_cta_whatsapp_message), ''),
    'Hi I am interested in RSA Membership ' || name || ' Plan'
  )
WHERE UPPER(COALESCE(membership_type, 'SERVICE')) = 'RSA';
