-- Enable Settings screen placement for all smart tools by default.

UPDATE public.smart_tools
SET placements = jsonb_set(
  COALESCE(placements, '{}'::jsonb),
  '{settings,before_menu}',
  'true'::jsonb,
  true
)
WHERE enabled = true;
