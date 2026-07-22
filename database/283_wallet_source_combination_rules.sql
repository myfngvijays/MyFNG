-- Combined wallet source groups: multiple sources share one usage cap (e.g. Welcome + Referral @ 15%)

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  (
    'wallet_source_combination_enabled',
    'false',
    'BOOLEAN',
    'WALLET',
    'When enabled, configured source groups share a single usage % cap instead of separate per-source caps',
    'false',
    true
  ),
  (
    'wallet_source_combination_rules',
    '[{"id":"default-welcome-referral","label":"Welcome + Referral","sources":["welcome_bonus","referral"],"service_percent":15,"membership_percent":30,"active":true}]',
    'JSON',
    'WALLET',
    'JSON array of source combination rules — each group sums balances and applies one shared cap',
    '[]',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;
