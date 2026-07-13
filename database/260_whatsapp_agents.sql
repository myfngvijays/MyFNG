-- ============================================
-- WhatsApp Agents: Booking, Follow-up, Chase
-- Purpose: Per-lead AI agent instances with memory, scheduling, audit
-- Depends on: service_leads, telecrm_api, users_login
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. Agent configs (one row per agent type)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_agent_configs (
  agent_type VARCHAR(20) PRIMARY KEY
    CHECK (agent_type IN ('BOOKING', 'FOLLOWUP', 'CHASE')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  model VARCHAR(30) NOT NULL DEFAULT 'gpt-4o-mini'
    CHECK (model IN ('gpt-4o', 'gpt-4o-mini')),
  goal_prompt TEXT NOT NULL DEFAULT '',
  system_prompt_addon TEXT NOT NULL DEFAULT '',
  fallback_message TEXT NOT NULL DEFAULT 'Thanks for reaching out to MyFNG! Our team will get back to you shortly.',
  rules_json JSONB NOT NULL DEFAULT '{
    "max_follow_ups": 5,
    "min_wait_hours": 24,
    "max_daily_messages": 2,
    "business_hours": {"start": "09:00", "end": "20:00", "timezone": "Asia/Kolkata"},
    "allowed_languages": ["en", "hi"],
    "confidence_threshold": 0.7,
    "blocked_words": [],
    "dnd_hours": {"start": "21:00", "end": "08:00"},
    "escalation_keywords": ["human", "agent", "complaint"],
    "skip_assigned_chats": true
  }'::jsonb,
  triggers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tools_json JSONB NOT NULL DEFAULT '{
    "pricing": true,
    "workshops": true,
    "service_details": true,
    "booking": true
  }'::jsonb,
  telecrm_sync_json JSONB NOT NULL DEFAULT '{
    "on_booking": {"disposition": "Booked", "disposition_category": "Converted"},
    "on_escalation": {"disposition": "Escalated", "disposition_category": "Human"},
    "on_end_max_attempts": {"disposition": "Cold", "disposition_category": "Lost"}
  }'::jsonb,
  updated_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_agent_configs IS
  'Per-agent-type configuration: prompt, rules, triggers, tools. Managed from Bot Flow admin.';

-- --------------------------------------------
-- 2. Agent instances (one per lead/phone per type)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type VARCHAR(20) NOT NULL
    CHECK (agent_type IN ('BOOKING', 'FOLLOWUP', 'CHASE')),
  phone VARCHAR(20) NOT NULL,
  lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  telecrm_id UUID REFERENCES public.telecrm_api(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'WAITING', 'PAUSED', 'ESCALATED', 'ENDED')),
  goal TEXT,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  last_customer_reply_at TIMESTAMPTZ,
  next_wakeup_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalated_to UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  ended_at TIMESTAMPTZ,
  end_reason VARCHAR(50)
    CHECK (end_reason IS NULL OR end_reason IN (
      'CONVERTED', 'MAX_ATTEMPTS', 'CUSTOMER_OPT_OUT',
      'MANUAL', 'ESCALATED', 'ERROR'
    )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_agent_instances IS
  'Running agent instance per phone per agent type. Tracks status, follow-up count, next wakeup.';

-- Only one non-ended instance per agent_type + phone
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_instance_active_phone
  ON public.whatsapp_agent_instances (agent_type, phone)
  WHERE status NOT IN ('ENDED');

CREATE INDEX IF NOT EXISTS idx_agent_instances_status
  ON public.whatsapp_agent_instances (status);

CREATE INDEX IF NOT EXISTS idx_agent_instances_agent_type_status
  ON public.whatsapp_agent_instances (agent_type, status);

CREATE INDEX IF NOT EXISTS idx_agent_instances_next_wakeup
  ON public.whatsapp_agent_instances (next_wakeup_at)
  WHERE status IN ('ACTIVE', 'WAITING') AND next_wakeup_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_instances_lead_id
  ON public.whatsapp_agent_instances (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_instances_phone
  ON public.whatsapp_agent_instances (phone);

-- --------------------------------------------
-- 3. Agent memory (1:1 with instance)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_agent_memory (
  instance_id UUID PRIMARY KEY
    REFERENCES public.whatsapp_agent_instances(id) ON DELETE CASCADE,
  lead_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  conversation_summary TEXT NOT NULL DEFAULT '',
  buying_intent VARCHAR(20) NOT NULL DEFAULT 'NONE'
    CHECK (buying_intent IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
  sentiment VARCHAR(20) NOT NULL DEFAULT 'NEUTRAL'
    CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'ANGRY')),
  customer_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  crm_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_agent_memory IS
  'Per-instance memory: summary, intent, sentiment, CRM snapshot, sent messages.';

-- --------------------------------------------
-- 4. Agent actions (immutable audit log)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL
    REFERENCES public.whatsapp_agent_instances(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL
    CHECK (event_type IN (
      'NEW_LEAD', 'CUSTOMER_REPLY', 'SCHEDULED_WAKEUP',
      'CRM_UPDATE', 'MANUAL_TRIGGER', 'ACTIVATE_BOOKING_BOT'
    )),
  ai_decision JSONB,
  validated_action VARCHAR(30),
  execution_status VARCHAR(20) NOT NULL DEFAULT 'SKIPPED'
    CHECK (execution_status IN ('EXECUTED', 'BLOCKED', 'FAILED', 'SKIPPED')),
  block_reason TEXT,
  message_sent TEXT,
  wait_until TIMESTAMPTZ,
  confidence NUMERIC(4,3),
  reason TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_agent_actions IS
  'Immutable audit log of every AI decision and execution result.';

CREATE INDEX IF NOT EXISTS idx_agent_actions_instance_id
  ON public.whatsapp_agent_actions (instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at
  ON public.whatsapp_agent_actions (created_at DESC);

-- --------------------------------------------
-- 5. Scheduled wakeups (cron picks these up)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_agent_scheduled_wakeups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL UNIQUE
    REFERENCES public.whatsapp_agent_instances(id) ON DELETE CASCADE,
  wake_at TIMESTAMPTZ NOT NULL,
  event_type VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED_FOLLOWUP'
    CHECK (event_type IN ('SCHEDULED_FOLLOWUP', 'CHASE_RETRY', 'FOLLOWUP_TRIGGER')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_agent_scheduled_wakeups IS
  'Next scheduled agent wakeup. Cron processes PENDING rows where wake_at <= now().';

CREATE INDEX IF NOT EXISTS idx_agent_wakeups_pending
  ON public.whatsapp_agent_scheduled_wakeups (wake_at)
  WHERE status = 'PENDING';

-- --------------------------------------------
-- 6. RLS (admin only — same pattern as bot_flows)
-- --------------------------------------------
ALTER TABLE public.whatsapp_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_agent_scheduled_wakeups ENABLE ROW LEVEL SECURITY;

-- Helper: admin check
CREATE OR REPLACE FUNCTION public.is_whatsapp_agent_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE (
      ul.id = auth.uid()
      OR lower(ul.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      OR ul.phone = (auth.jwt() ->> 'phone')
    )
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  );
$$;

-- Configs: admin read/write
DROP POLICY IF EXISTS "Admins manage agent configs" ON public.whatsapp_agent_configs;
CREATE POLICY "Admins manage agent configs" ON public.whatsapp_agent_configs
FOR ALL USING (public.is_whatsapp_agent_admin())
WITH CHECK (public.is_whatsapp_agent_admin());

-- Instances: admin read/write
DROP POLICY IF EXISTS "Admins manage agent instances" ON public.whatsapp_agent_instances;
CREATE POLICY "Admins manage agent instances" ON public.whatsapp_agent_instances
FOR ALL USING (public.is_whatsapp_agent_admin())
WITH CHECK (public.is_whatsapp_agent_admin());

-- Memory: admin read/write
DROP POLICY IF EXISTS "Admins manage agent memory" ON public.whatsapp_agent_memory;
CREATE POLICY "Admins manage agent memory" ON public.whatsapp_agent_memory
FOR ALL USING (public.is_whatsapp_agent_admin())
WITH CHECK (public.is_whatsapp_agent_admin());

-- Actions: admin read + service insert (audit)
DROP POLICY IF EXISTS "Admins read agent actions" ON public.whatsapp_agent_actions;
CREATE POLICY "Admins read agent actions" ON public.whatsapp_agent_actions
FOR SELECT USING (public.is_whatsapp_agent_admin());

DROP POLICY IF EXISTS "Service inserts agent actions" ON public.whatsapp_agent_actions;
CREATE POLICY "Service inserts agent actions" ON public.whatsapp_agent_actions
FOR INSERT WITH CHECK (true);

-- Wakeups: admin read + service manage
DROP POLICY IF EXISTS "Admins read agent wakeups" ON public.whatsapp_agent_scheduled_wakeups;
CREATE POLICY "Admins read agent wakeups" ON public.whatsapp_agent_scheduled_wakeups
FOR SELECT USING (public.is_whatsapp_agent_admin());

DROP POLICY IF EXISTS "Service manages agent wakeups" ON public.whatsapp_agent_scheduled_wakeups;
CREATE POLICY "Service manages agent wakeups" ON public.whatsapp_agent_scheduled_wakeups
FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------
-- 7. Seed default configs (disabled)
-- --------------------------------------------
INSERT INTO public.whatsapp_agent_configs (agent_type, enabled, goal_prompt, system_prompt_addon, triggers_json, tools_json)
VALUES
  (
    'BOOKING',
    false,
    'You are MyFNG Booking Assistant on WhatsApp. Help the customer complete a service booking. Steps: 1) Get car model + pincode 2) Show pricing 3) Confirm service type 4) Get preferred date 5) Create booking. Keep replies under 900 characters. No markdown **.',
    'MISA = MyFNG Instant Service Assistant. Use tools for pricing and booking. If RSA/towing, hand off immediately.',
    '{}'::jsonb,
    '{"pricing": true, "workshops": true, "service_details": true, "booking": true}'::jsonb
  ),
  (
    'FOLLOWUP',
    false,
    'You are MyFNG Follow-up Assistant. Send a single gentle check-in message based on the scheduled follow-up context. Keep it short, friendly, one question. Do not be pushy.',
    'WhatsApp channel. Under 500 characters. One clear question.',
    '{
      "telecaller_follow_up": {"enabled": true, "offset_minutes": 0},
      "service_due_reminder": {"enabled": false},
      "cse_callback": {"enabled": false},
      "incomplete_booking": {"enabled": true, "delay_hours": 2}
    }'::jsonb,
    '{"pricing": false, "workshops": false, "service_details": false, "booking": false}'::jsonb
  ),
  (
    'CHASE',
    false,
    'You are MyFNG Sales Follow-up Agent. Convert this lead into a booked service. Follow up persistently but politely. Increase urgency gradually. If buying intent detected, activate booking bot. If stop/unsubscribe, end immediately. If angry, escalate.',
    'WhatsApp channel. Under 700 characters. Never more than one question per message.',
    '{
      "telecrm_new_lead": {"enabled": true, "dispositions": ["New", "Interested"]},
      "no_reply_hours": 48,
      "cold_lead_days": 3,
      "dispositions_to_chase": ["Interested", "Callback", "Quotation Sent"]
    }'::jsonb,
    '{"pricing": true, "workshops": false, "service_details": false, "booking": false}'::jsonb
  )
ON CONFLICT (agent_type) DO NOTHING;

-- --------------------------------------------
-- 8. Updated_at trigger
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_whatsapp_agent_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_configs_updated ON public.whatsapp_agent_configs;
CREATE TRIGGER trg_agent_configs_updated
  BEFORE UPDATE ON public.whatsapp_agent_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_agent_updated_at();

DROP TRIGGER IF EXISTS trg_agent_instances_updated ON public.whatsapp_agent_instances;
CREATE TRIGGER trg_agent_instances_updated
  BEFORE UPDATE ON public.whatsapp_agent_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_agent_updated_at();

DROP TRIGGER IF EXISTS trg_agent_memory_updated ON public.whatsapp_agent_memory;
CREATE TRIGGER trg_agent_memory_updated
  BEFORE UPDATE ON public.whatsapp_agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_agent_updated_at();

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ WhatsApp Agents tables created: configs, instances, memory, actions, scheduled_wakeups';
  RAISE NOTICE '✅ Seeded 3 agent configs (BOOKING, FOLLOWUP, CHASE) — all disabled by default';
END $$;
