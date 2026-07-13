-- ============================================
-- Follow-up Bot: enable config + outbound template defaults
-- Run after 260_whatsapp_agents.sql
-- ============================================

BEGIN;

UPDATE public.whatsapp_agent_configs
SET
  triggers_json = triggers_json || jsonb_build_object(
    'outbound_template_name', 'app_session_incomplete',
    'outbound_template_language', 'en',
    'telecaller_offset_minutes', 0,
    'incomplete_booking_delay_hours', 2
  ),
  rules_json = rules_json || jsonb_build_object(
    'max_follow_ups', 1,
    'max_daily_messages', 1
  ),
  updated_at = NOW()
WHERE agent_type = 'FOLLOWUP';

COMMIT;
