-- Partner app force-update settings. Customer thresholds stay on the existing keys.
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  (
    'mobile_app_partner_force_update_enabled',
    'false',
    'BOOLEAN',
    'MOBILE',
    'Block old MyFNG Partner app versions and show update popup',
    'false',
    true
  ),
  (
    'mobile_app_partner_min_version_android',
    '1.0.1',
    'STRING',
    'MOBILE',
    'Minimum Android version for MyFNG Partner (com.myfng.partner)',
    '1.0.1',
    true
  ),
  (
    'mobile_app_partner_min_build_android',
    '1',
    'NUMBER',
    'MOBILE',
    'Minimum Android versionCode for MyFNG Partner',
    '1',
    true
  ),
  (
    'mobile_app_partner_min_version_ios',
    '1.0.1',
    'STRING',
    'MOBILE',
    'Minimum iOS version for MyFNG Partner',
    '1.0.1',
    true
  ),
  (
    'mobile_app_partner_min_build_ios',
    '1',
    'NUMBER',
    'MOBILE',
    'Minimum iOS build number for MyFNG Partner',
    '1',
    true
  ),
  (
    'mobile_app_partner_play_store_url',
    'https://play.google.com/store/apps/details?id=com.myfng.partner',
    'STRING',
    'MOBILE',
    'Google Play URL for MyFNG Partner',
    'https://play.google.com/store/apps/details?id=com.myfng.partner',
    true
  ),
  (
    'mobile_app_partner_app_store_url',
    'https://apps.apple.com/in/app/myfng-partner',
    'STRING',
    'MOBILE',
    'App Store URL for MyFNG Partner',
    'https://apps.apple.com/in/app/myfng-partner',
    true
  ),
  (
    'mobile_app_partner_force_update_message',
    'A new version of MyFNG Partner is available. Please update the app to continue.',
    'STRING',
    'MOBILE',
    'Force update popup message for MyFNG Partner',
    'A new version of MyFNG Partner is available. Please update the app to continue.',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;
