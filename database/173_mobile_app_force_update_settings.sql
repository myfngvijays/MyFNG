-- Mobile app force-update settings (Android + iOS)
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  (
    'mobile_app_force_update_enabled',
    'true',
    'BOOLEAN',
    'MOBILE',
    'Block old app versions and show update popup',
    'true',
    true
  ),
  (
    'mobile_app_min_version_android',
    '1.2.0',
    'STRING',
    'MOBILE',
    'Minimum Android app version required',
    '1.2.0',
    true
  ),
  (
    'mobile_app_min_version_ios',
    '1.2.0',
    'STRING',
    'MOBILE',
    'Minimum iOS app version required',
    '1.2.0',
    true
  ),
  (
    'mobile_app_min_build_android',
    '23',
    'NUMBER',
    'MOBILE',
    'Minimum Android versionCode required',
    '23',
    true
  ),
  (
    'mobile_app_min_build_ios',
    '23',
    'NUMBER',
    'MOBILE',
    'Minimum iOS build number required',
    '23',
    true
  ),
  (
    'mobile_app_play_store_url',
    'https://play.google.com/store/apps/details?id=com.myfng.app',
    'STRING',
    'MOBILE',
    'Google Play Store URL for MyFNG app',
    'https://play.google.com/store/apps/details?id=com.myfng.app',
    true
  ),
  (
    'mobile_app_app_store_url',
    'https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114',
    'STRING',
    'MOBILE',
    'Apple App Store URL for MyFNG app',
    'https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114',
    true
  ),
  (
    'mobile_app_force_update_message',
    'A new version of MyFNG is available. Please update the app to continue.',
    'STRING',
    'MOBILE',
    'Force update popup message shown in mobile app',
    'A new version of MyFNG is available. Please update the app to continue.',
    true
  )
ON CONFLICT (setting_key) DO NOTHING;
