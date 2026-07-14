-- Phase 4: expand agent action event types for follow-up + send retry logging

BEGIN;

ALTER TABLE public.whatsapp_agent_actions
  DROP CONSTRAINT IF EXISTS whatsapp_agent_actions_event_type_check;

ALTER TABLE public.whatsapp_agent_actions
  ADD CONSTRAINT whatsapp_agent_actions_event_type_check
  CHECK (event_type IN (
    'NEW_LEAD',
    'CUSTOMER_REPLY',
    'SCHEDULED_WAKEUP',
    'CRM_UPDATE',
    'MANUAL_TRIGGER',
    'ACTIVATE_BOOKING_BOT',
    'FOLLOWUP_TRIGGER',
    'SEND_RETRY'
  ));

COMMIT;
