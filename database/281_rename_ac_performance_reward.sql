-- Rename milestone 12 MYFNG Save reward in stored Refer & Rise admin config.
UPDATE system_settings
SET
  setting_value = REPLACE(
    setting_value::text,
    '"Free Basic AC Service"',
    '"Car AC Performance Package"'
  )::jsonb,
  updated_at = NOW()
WHERE setting_key = 'refer_and_rise_config'
  AND setting_value::text LIKE '%Free Basic AC Service%';

-- Also normalize interim code label if present.
UPDATE system_settings
SET
  setting_value = REPLACE(
    setting_value::text,
    '"Car AC Performance Package (Free)"',
    '"Car AC Performance Package"'
  )::jsonb,
  updated_at = NOW()
WHERE setting_key = 'refer_and_rise_config'
  AND setting_value::text LIKE '%Car AC Performance Package (Free)%';
