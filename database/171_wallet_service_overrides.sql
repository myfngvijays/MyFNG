-- Advanced per-service wallet overrides

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('wallet_advanced_enabled', 'false', 'BOOLEAN', 'WALLET', 'Enable per-service wallet rule overrides', 'false', true),
  ('wallet_service_overrides', '[]', 'JSON', 'WALLET', 'Custom wallet rules per service_type (JSON array)', '[]', true)
ON CONFLICT (setting_key) DO NOTHING;
