-- Meta Ads MCP credentials (token stored via Super Admin → Meta Ads MCP)

INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  description,
  default_value,
  is_editable
)
VALUES
  (
    'meta_ads_access_token',
    '',
    'STRING',
    'INTEGRATIONS',
    'Meta Marketing API access token (System User or long-lived). Used by Super Admin Meta Ads MCP.',
    '',
    true
  ),
  (
    'meta_ads_account_id',
    '',
    'STRING',
    'INTEGRATIONS',
    'Default Meta Ad Account ID (act_…). Used by Super Admin Meta Ads MCP.',
    '',
    true
  ),
  (
    'meta_ads_app_id',
    '',
    'STRING',
    'INTEGRATIONS',
    'Optional Meta App ID for the ads MCP connection.',
    '',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;
