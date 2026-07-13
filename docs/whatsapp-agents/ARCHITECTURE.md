# MyFNG WhatsApp Agents — Architecture & Design

> **Scope:** Three internal WhatsApp bots inside MyFNG (not SaaS), managed from the existing **Bot Flow** admin panel, integrated with **TeleCRM**.

| Bot | Purpose | Direction |
|-----|---------|-----------|
| **Booking Bot** | Complete service bookings via WhatsApp conversation | Inbound (reactive) |
| **Follow-up Bot** | Scheduled gentle reminders and check-ins | Outbound (scheduled) |
| **Chase Bot** | Persistent follow-up until conversion or max attempts | Outbound (proactive) |

**Core principle:** AI only returns structured JSON decisions. Backend validates every decision via the Rule Engine before execution.

**Stack:** Next.js API Routes · Supabase PostgreSQL · OpenAI · Meta WhatsApp Cloud API · TeleCRM

---

## Table of Contents

1. [Folder Structure](#1-folder-structure)
2. [Database Schema](#2-database-schema)
3. [API Design](#3-api-design)
4. [Architecture](#4-architecture)
5. [Development Roadmap](#5-development-roadmap)

---

## 1. Folder Structure

```
apps/web/src/
├── lib/whatsappAgents/                    # Core agent engine (NEW)
│   ├── shared/
│   │   ├── types.ts                       # AgentType, AgentStatus, Decision, Memory
│   │   ├── decisionSchema.ts              # Zod schema for LLM JSON output
│   │   ├── validateDecision.ts            # Parse + validate AI JSON
│   │   ├── ruleEngine.ts                  # Hard limits (max follow-ups, DND, hours)
│   │   ├── memoryService.ts               # Load/save per-instance memory
│   │   ├── agentRunner.ts                 # Main loop: context → LLM → validate → execute
│   │   ├── agentEvents.ts                 # Event types + dispatch
│   │   ├── executeAction.ts               # SEND_MESSAGE, WAIT, UPDATE_CRM, etc.
│   │   ├── buildContext.ts                # Assemble prompt context from all sources
│   │   ├── telecrmSync.ts                 # Read telecrm_api, push disposition updates
│   │   └── sessionBridge.ts               # Bridge to bot_flow_sessions + sessionWindow
│   │
│   ├── booking/
│   │   ├── config.ts                      # BookingAgentConfig type + defaults
│   │   ├── prompt.ts                      # System prompt builder
│   │   ├── handler.ts                     # Inbound message handler
│   │   └── tools.ts                       # Re-export filtered CHATBOT_TOOLS
│   │
│   ├── followup/
│   │   ├── config.ts                      # FollowupAgentConfig + trigger definitions
│   │   ├── prompt.ts                      # System prompt for check-in messages
│   │   ├── handler.ts                     # Scheduled wake handler
│   │   └── triggers.ts                    # Map telecaller_follow_ups, CSE, service_due
│   │
│   └── chase/
│       ├── config.ts                      # ChaseAgentConfig + TeleCRM trigger rules
│       ├── prompt.ts                      # Persistence / conversion prompt
│       ├── handler.ts                     # Proactive follow-up loop handler
│       └── scheduler.ts                   # Pick due instances, enqueue wake events
│
├── app/api/whatsapp/agents/               # Agent APIs (NEW)
│   ├── utils.ts                           # Auth guard (SUPER_ADMIN + SUB_ADMIN)
│   ├── booking/
│   │   └── config/route.ts                # GET/PATCH booking agent config
│   ├── followup/
│   │   └── config/route.ts                # GET/PATCH follow-up agent config
│   ├── chase/
│   │   ├── config/route.ts                # GET/PATCH chase agent config
│   │   └── leads/route.ts                 # Active chase leads list
│   ├── instances/
│   │   ├── route.ts                       # List agent instances (filter by type/status)
│   │   └── [id]/
│   │       ├── route.ts                   # Get instance detail + memory + actions
│   │       ├── trigger/route.ts           # Manual trigger (admin)
│   │       ├── pause/route.ts             # Pause instance
│   │       └── escalate/route.ts          # Force human handover
│   ├── test/route.ts                      # Dry-run decision (like brain/test)
│   └── analytics/route.ts                 # Conversion, response rate, escalations
│
├── app/api/cron/whatsapp-agents/
│   └── route.ts                           # Scheduler cron (chase + followup wakeups)
│
├── app/api/webhooks/
│   ├── whatsapp/route.ts                  # EXISTING — extend to route to agents
│   └── telecrm/route.ts                   # NEW — inbound TeleCRM lead webhook
│
├── app/dashboard/super_admin/bot-flow/
│   ├── page.tsx                           # EXISTING — add tab navigation
│   ├── builder/page.tsx                   # EXISTING — visual flow builder (unchanged)
│   └── components/                        # NEW tab panels
│       ├── AgentTabs.tsx                    # Tab switcher: Brain | Booking | Follow-up | Chase
│       ├── BookingAgentPanel.tsx            # Prompt, tools, rules, enable toggle
│       ├── FollowupAgentPanel.tsx           # Triggers, schedule, templates, enable
│       ├── ChaseAgentPanel.tsx              # Goal prompt, rules, TeleCRM triggers
│       ├── AgentRulesEditor.tsx             # Shared rules UI (max follow-ups, DND, hours)
│       ├── AgentLeadsDashboard.tsx          # Active instances table
│       └── AgentTestConsole.tsx             # Dry-run test (reuse brain test pattern)
│
└── components/shared/bot-flow/              # EXISTING — unchanged

database/
└── 260_whatsapp_agents.sql                  # Migration (see Section 2)

docs/whatsapp-agents/
├── ARCHITECTURE.md                          # This file
└── API.md                                   # Detailed API reference (generated from Section 3)
```

### Reused existing modules (no duplication)

| Module | Path | Used by |
|--------|------|---------|
| WhatsApp send | `lib/services/whatsappService.ts` | All agents |
| 24h session window | `lib/whatsappBotFlow/sessionWindow.ts` | Outbound agents |
| Human handoff | `lib/whatsappBotFlow/handoff.ts` | Chase + Booking |
| MISA tools | `lib/chatbot_v2/chatbot-tools.ts` | Booking Bot |
| MISA agent loop | `lib/chatbot_v2/runAgent.ts` | Booking Bot (tool-calling mode) |
| TeleCRM push | `lib/telecrm/push.ts` | All agents (UPDATE_CRM) |
| TeleCRM read | `lib/chatbot_v2/telecrm.ts` | Chase Bot triggers |
| Brain config pattern | `lib/whatsappBotFlow/brainConfig.ts` | Config storage pattern |
| Flow executor | `lib/whatsappBotFlow/executor.ts` | Inbound router (unchanged) |

---

## 2. Database Schema

Migration file: `database/260_whatsapp_agents.sql`

### Entity Relationship

```
whatsapp_agent_configs (1 per agent type)
        │
        ▼
whatsapp_agent_instances (1 per lead/phone per agent type)
        │
        ├──► whatsapp_agent_memory (1:1 JSONB)
        ├──► whatsapp_agent_actions (1:N audit log)
        └──► whatsapp_agent_scheduled_wakeups (0..1 next action)
```

### Tables

#### `whatsapp_agent_configs`

One row per agent type. Stores prompt, rules, model, enable flag.

| Column | Type | Description |
|--------|------|-------------|
| `agent_type` | VARCHAR(20) PK | `BOOKING` \| `FOLLOWUP` \| `CHASE` |
| `enabled` | BOOLEAN | Master on/off |
| `model` | VARCHAR(30) | `gpt-4o` \| `gpt-4o-mini` |
| `goal_prompt` | TEXT | Natural language business rules |
| `system_prompt_addon` | TEXT | Channel-specific instructions |
| `fallback_message` | TEXT | When AI fails or rules block |
| `rules_json` | JSONB | Rule engine config (see below) |
| `triggers_json` | JSONB | Follow-up/Chase trigger definitions |
| `tools_json` | JSONB | Enabled tools per agent |
| `telecrm_sync_json` | JSONB | Disposition mapping on actions |
| `updated_by` | UUID FK | Last editor |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`rules_json` shape:**

```json
{
  "max_follow_ups": 5,
  "min_wait_hours": 24,
  "max_daily_messages": 2,
  "business_hours": { "start": "09:00", "end": "20:00", "timezone": "Asia/Kolkata" },
  "allowed_languages": ["en", "hi"],
  "confidence_threshold": 0.7,
  "blocked_words": ["refund scam"],
  "dnd_hours": { "start": "21:00", "end": "08:00" },
  "escalation_keywords": ["human", "agent", "complaint", "angry"],
  "skip_assigned_chats": true
}
```

**`triggers_json` shape (FOLLOWUP):**

```json
{
  "telecaller_follow_up": { "enabled": true, "offset_minutes": 0 },
  "service_due_reminder": { "enabled": true },
  "cse_callback": { "enabled": true },
  "incomplete_booking": { "enabled": true, "delay_hours": 2 }
}
```

**`triggers_json` shape (CHASE):**

```json
{
  "telecrm_new_lead": { "enabled": true, "dispositions": ["New", "Interested"] },
  "no_reply_hours": 48,
  "cold_lead_days": 3,
  "dispositions_to_chase": ["Interested", "Callback", "Quotation Sent"]
}
```

#### `whatsapp_agent_instances`

One running agent per lead (or phone if no lead_id).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `agent_type` | VARCHAR(20) | `BOOKING` \| `FOLLOWUP` \| `CHASE` |
| `phone` | VARCHAR(20) NOT NULL | Normalized 10-digit |
| `lead_id` | UUID FK → `service_leads` | Nullable |
| `telecrm_id` | UUID FK → `telecrm_api` | Nullable |
| `status` | VARCHAR(20) | See status enum below |
| `goal` | TEXT | Instance-specific goal override |
| `follow_up_count` | INTEGER DEFAULT 0 | Messages sent by this agent |
| `last_action_at` | TIMESTAMPTZ | |
| `last_customer_reply_at` | TIMESTAMPTZ | |
| `next_wakeup_at` | TIMESTAMPTZ | Denormalized from scheduled_wakeups |
| `escalated_at` | TIMESTAMPTZ | |
| `escalated_to` | UUID FK → `users_login` | |
| `ended_at` | TIMESTAMPTZ | |
| `end_reason` | VARCHAR(50) | `CONVERTED` \| `MAX_ATTEMPTS` \| `CUSTOMER_OPT_OUT` \| `MANUAL` |
| `metadata` | JSONB | Trigger source, campaign ref, etc. |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Status enum:** `ACTIVE` · `WAITING` · `PAUSED` · `ESCALATED` · `ENDED`

**Unique constraint:** `(agent_type, phone)` WHERE `status NOT IN ('ENDED')` — one active instance per type per phone.

#### `whatsapp_agent_memory`

| Column | Type | Description |
|--------|------|-------------|
| `instance_id` | UUID PK FK | |
| `lead_details` | JSONB | Name, car, city, pincode from CRM |
| `conversation_summary` | TEXT | Rolling AI summary |
| `buying_intent` | VARCHAR(20) | `HIGH` \| `MEDIUM` \| `LOW` \| `NONE` |
| `sentiment` | VARCHAR(20) | `POSITIVE` \| `NEUTRAL` \| `NEGATIVE` \| `ANGRY` |
| `customer_preferences` | JSONB | Preferred time, language, service type |
| `sent_messages` | JSONB | Array of outbound message refs |
| `crm_snapshot` | JSONB | Last known TeleCRM fields |
| `extra` | JSONB | Extensible |
| `updated_at` | TIMESTAMPTZ | |

#### `whatsapp_agent_actions`

Immutable audit log of every AI decision and execution result.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `instance_id` | UUID FK | |
| `event_type` | VARCHAR(30) | `NEW_LEAD` \| `CUSTOMER_REPLY` \| `SCHEDULED_WAKEUP` \| `CRM_UPDATE` \| `MANUAL_TRIGGER` |
| `ai_decision` | JSONB | Raw LLM JSON output |
| `validated_action` | VARCHAR(30) | After rule engine |
| `execution_status` | VARCHAR(20) | `EXECUTED` \| `BLOCKED` \| `FAILED` \| `SKIPPED` |
| `block_reason` | TEXT | If blocked by rules |
| `message_sent` | TEXT | If SEND_MESSAGE |
| `wait_until` | TIMESTAMPTZ | If WAIT |
| `confidence` | NUMERIC(4,3) | |
| `reason` | TEXT | AI explanation |
| `latency_ms` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |

#### `whatsapp_agent_scheduled_wakeups`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `instance_id` | UUID FK UNIQUE | One pending wakeup per instance |
| `wake_at` | TIMESTAMPTZ NOT NULL | |
| `event_type` | VARCHAR(30) | `SCHEDULED_FOLLOWUP` \| `CHASE_RETRY` |
| `status` | VARCHAR(20) | `PENDING` \| `PROCESSING` \| `DONE` \| `CANCELLED` |
| `created_at` | TIMESTAMPTZ | |

**Index:** `(wake_at)` WHERE `status = 'PENDING'` — cron picks due wakeups.

### Links to existing tables

| Existing table | Relationship |
|----------------|--------------|
| `telecrm_api` | Chase Bot reads new leads; all agents push disposition updates |
| `service_leads` | `lead_id` on instances |
| `telecaller_follow_ups` | Follow-up Bot trigger source |
| `whatsapp_messages` | Conversation history loaded into context |
| `whatsapp_chat_assignments` | Human handoff target |
| `bot_flow_sessions` | Inbound router session (Booking Bot reads) |
| `whatsapp_automation_settings` | Follow-up Bot can reuse template config |
| `system_settings` | Inbound brain config stays separate (`whatsapp_ai_brain_config`) |

---

## 3. API Design

Base path: `/api/whatsapp/agents`
Auth: `SUPER_ADMIN` + `SUB_ADMIN` (same as bot-flow utils)

### 3.1 Config APIs

#### `GET /api/whatsapp/agents/booking/config`

Returns booking agent config + runtime status.

```json
{
  "config": {
    "agent_type": "BOOKING",
    "enabled": true,
    "model": "gpt-4o-mini",
    "goal_prompt": "Help customer complete a service booking...",
    "rules_json": { "business_hours": { "start": "09:00", "end": "20:00" } },
    "tools_json": { "pricing": true, "booking": true, "workshops": true }
  },
  "runtime": {
    "openai_configured": true,
    "whatsapp_configured": true,
    "active_instances": 12
  }
}
```

#### `PATCH /api/whatsapp/agents/booking/config`

Partial update. Same shape as GET `config` object.

#### `GET/PATCH /api/whatsapp/agents/followup/config`

Same pattern. `triggers_json` editable.

#### `GET/PATCH /api/whatsapp/agents/chase/config`

Same pattern. `triggers_json` includes TeleCRM disposition filters.

---

### 3.2 Instance APIs

#### `GET /api/whatsapp/agents/instances`

Query params: `agent_type`, `status`, `phone`, `lead_id`, `page`, `limit`

```json
{
  "instances": [
    {
      "id": "uuid",
      "agent_type": "CHASE",
      "phone": "9876543210",
      "lead_id": "uuid",
      "status": "WAITING",
      "follow_up_count": 2,
      "next_wakeup_at": "2026-07-16T09:00:00+05:30",
      "memory": { "buying_intent": "MEDIUM", "sentiment": "NEUTRAL" }
    }
  ],
  "total": 45,
  "page": 1
}
```

#### `GET /api/whatsapp/agents/instances/:id`

Full detail: instance + memory + last 20 actions + conversation preview.

#### `POST /api/whatsapp/agents/instances/:id/trigger`

Manual admin trigger. Body: `{ "event_type": "MANUAL_TRIGGER", "note": "Admin re-engaged" }`

#### `POST /api/whatsapp/agents/instances/:id/pause`

Pause agent instance. Body: `{ "reason": "Customer called directly" }`

#### `POST /api/whatsapp/agents/instances/:id/escalate`

Force human handover. Body: `{ "assign_to": "uuid", "note": "Low confidence" }`

---

### 3.3 Chase Leads Dashboard

#### `GET /api/whatsapp/agents/chase/leads`

Active chase instances with CRM data.

Query: `status=ACTIVE|WAITING`, `sort=next_wakeup_at`

---

### 3.4 Test API

#### `POST /api/whatsapp/agents/test`

Dry-run (no send). Body:

```json
{
  "agent_type": "CHASE",
  "phone": "9876543210",
  "event_type": "SCHEDULED_WAKEUP",
  "mock_memory": { "buying_intent": "HIGH" },
  "mock_crm": { "name": "Rahul", "vehicle_model": "Swift" }
}
```

Response:

```json
{
  "decision": {
    "action": "SEND_MESSAGE",
    "message": "Hi Rahul, Swift ki service ke liye slot available hai...",
    "wait_days": 2,
    "confidence": 0.91,
    "reason": "Lead showed interest, no reply in 48h"
  },
  "validation": { "passed": true },
  "would_execute": true
}
```

---

### 3.5 Analytics API

#### `GET /api/whatsapp/agents/analytics`

Query: `agent_type`, `from`, `to`

```json
{
  "booking": { "conversations": 120, "bookings_created": 34, "conversion_rate": 0.28 },
  "followup": { "sent": 89, "replied": 41, "response_rate": 0.46 },
  "chase": { "active": 23, "converted": 8, "escalated": 3, "ended_max_attempts": 5 }
}
```

---

### 3.6 Cron API

#### `GET /api/cron/whatsapp-agents`

Called by Vercel cron / external scheduler every 5 minutes.

1. Pick `whatsapp_agent_scheduled_wakeups` WHERE `wake_at <= now()` AND `status = 'PENDING'`
2. For each: load instance → run agent → execute → schedule next wakeup
3. Pick new TeleCRM leads for Chase Bot (if trigger enabled)
4. Pick due `telecaller_follow_ups` for Follow-up Bot

Auth: `CRON_SECRET` header (same pattern as existing crons).

---

### 3.7 Webhook Extensions

#### Existing: `POST /api/webhooks/whatsapp`

Extended routing logic:

```
Inbound message
  → Is chat assigned to human? → skip (if rule enabled)
  → Is there ACTIVE Booking instance? → Booking Bot handler
  → Is there ACTIVE Chase instance with recent reply? → Chase Bot handler (CUSTOMER_REPLY event)
  → Else → existing brain.ts (MISA + flow executor)
```

#### New: `POST /api/webhooks/telecrm`

Inbound lead from TeleCRM → create Chase instance if triggers match.

---

### 3.8 AI Decision Contract

All agents use the same JSON schema. Booking Bot uses tool-calling mode for `create_booking`; Follow-up and Chase use decision-only mode.

```typescript
type AgentDecision = {
  action: 'SEND_MESSAGE' | 'WAIT' | 'UPDATE_CRM' | 'ASSIGN_TO_HUMAN' | 'BOOK_APPOINTMENT' | 'END_CONVERSATION' | 'ACTIVATE_BOOKING_BOT';
  message?: string;           // SEND_MESSAGE
  wait_hours?: number;        // WAIT (chase/followup)
  wait_days?: number;         // WAIT (chase)
  crm_fields?: Record<string, string>;  // UPDATE_CRM
  assign_reason?: string;     // ASSIGN_TO_HUMAN
  booking_details?: object;   // BOOK_APPOINTMENT
  end_reason?: string;        // END_CONVERSATION
  confidence: number;           // 0.0 – 1.0
  reason: string;             // AI explanation
};
```

**`ACTIVATE_BOOKING_BOT`** — Chase Bot hands off to Booking Bot when customer shows buying intent.

---

## 4. Architecture

### 4.1 High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Super Admin — Bot Flow Panel                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐ │
│  │ AI Brain │  │ Booking  │  │ Follow-up │  │  Chase   │  │  Leads  │ │
│  │ (inbound │  │  Agent   │  │   Agent   │  │  Agent   │  │Dashboard│ │
│  │  router) │  │  Config  │  │   Config  │  │  Config  │  │         │ │
│  └──────────┘  └──────────┘  └───────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Event Engine                                     │
│                                                                          │
│  NEW_LEAD ──── CUSTOMER_REPLY ──── SCHEDULED_WAKEUP ──── CRM_UPDATE     │
│  MANUAL_TRIGGER                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Runner                                     │
│                                                                          │
│  1. Load config (whatsapp_agent_configs)                                │
│  2. Load/create instance (whatsapp_agent_instances)                     │
│  3. Load memory + CRM + conversation + knowledge                        │
│  4. Build context → OpenAI (structured JSON mode)                         │
│  5. Parse decision JSON                                                 │
│  6. Rule Engine validate                                                │
│  7. Execute action                                                      │
│  8. Save memory + action audit log                                      │
│  9. Schedule next wakeup (if WAIT)                                      │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
   │  WhatsApp   │    │   TeleCRM    │    │   Handoff    │
   │  Connector  │    │   Connector  │    │  (Human)     │
   │ sessionWindow│   │  push.ts     │    │  handoff.ts  │
   └─────────────┘    └──────────────┘    └──────────────┘
```

### 4.2 Agent Interaction Flow

```
TeleCRM new lead (Interested)
        │
        ▼
  ┌───────────┐
  │ Chase Bot │ ──── Day 0: "Hi Rahul, Swift service?"
  └───────────┘
        │ no reply 48h
        ▼
  ┌───────────┐
  │ Chase Bot │ ──── Day 2: "Slot available Thursday?"
  └───────────┘
        │ customer replies: "price batao"
        ▼
  ┌─────────────┐
  │ Booking Bot │ ──── pricing → date → create_booking
  └─────────────┘
        │ booking created
        ▼
  Chase Bot END (CONVERTED) ──── TeleCRM disposition: Booked
```

### 4.3 Inbound WhatsApp Routing

```
POST /api/webhooks/whatsapp
        │
        ▼
  Archive to whatsapp_messages
        │
        ▼
  Skip if assigned to human? (config)
        │
        ▼
  ┌─ ACTIVE Booking instance? ──► booking/handler.ts (CUSTOMER_REPLY)
  │
  ├─ ACTIVE Chase instance? ────► chase/handler.ts (CUSTOMER_REPLY)
  │                                    └─ decision: ACTIVATE_BOOKING_BOT → create Booking instance
  │
  └─ Default ───────────────────► brain.ts (existing MISA + flow executor)
```

### 4.4 Rule Engine (runs before every execution)

```
AI Decision JSON
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ 1. Agent enabled?                       │
  │ 2. Instance status allows action?       │
  │ 3. follow_up_count < max_follow_ups?    │
  │ 4. Within business_hours?               │
  │ 5. Not in dnd_hours?                    │
  │ 6. Daily message count < max_daily?     │
  │ 7. wait_hours >= min_wait_hours?        │
  │ 8. confidence >= threshold?             │
  │ 9. No blocked_words in message?         │
  │ 10. Customer not opted out?             │
  │ 11. Chat not assigned to human?         │
  └─────────────────────────────────────────┘
        │
   PASS ──► executeAction()
   FAIL ──► log BLOCKED + optional ASSIGN_TO_HUMAN if confidence low
```

### 4.5 Layer Separation

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Controller** | HTTP routes, auth, request validation | `app/api/whatsapp/agents/` |
| **Service** | Agent orchestration, event dispatch | `lib/whatsappAgents/shared/agentRunner.ts` |
| **AI Engine** | Prompt build, OpenAI call, JSON parse | `lib/whatsappAgents/shared/buildContext.ts` + per-agent `prompt.ts` |
| **Rule Engine** | Hard constraint validation | `lib/whatsappAgents/shared/ruleEngine.ts` |
| **Scheduler** | Cron, wakeup queue | `lib/whatsappAgents/chase/scheduler.ts` + cron route |
| **Repository** | DB CRUD | `lib/whatsappAgents/shared/memoryService.ts` + Supabase queries |
| **Connectors** | WhatsApp, TeleCRM, Handoff | Existing libs + `telecrmSync.ts` |

### 4.6 Future Channel Plugin Interface

```typescript
// lib/whatsappAgents/shared/channelPlugin.ts
interface ChannelPlugin {
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  sendMessage(phone: string, message: string): Promise<SendResult>;
  isSessionOpen(phone: string): Promise<boolean>;
  sendTemplate(phone: string, template: string, params: string[]): Promise<SendResult>;
}
```

WhatsApp is the first plugin. Email/SMS can be added without changing agent logic.

---

## 5. Development Roadmap

### Phase 0 — Foundation (Week 1)

| Task | Output |
|------|--------|
| Run migration `260_whatsapp_agents.sql` | 5 new tables |
| Create `lib/whatsappAgents/shared/` core | types, decisionSchema, ruleEngine, agentRunner |
| Seed default configs for 3 agent types | Disabled by default |
| Add `AgentTabs.tsx` to bot-flow page | UI skeleton with 4 tabs |

**Exit criteria:** Tables exist, shared engine compiles, admin tabs visible.

---

### Phase 1 — Booking Bot (Week 2)

| Task | Output |
|------|--------|
| Extract booking logic from MISA/brain into `booking/handler.ts` | Dedicated inbound handler |
| Booking config API (GET/PATCH) | `/api/whatsapp/agents/booking/config` |
| BookingAgentPanel UI | Prompt editor, tools toggles, enable switch |
| Extend WhatsApp webhook routing | Booking instance takes priority |
| Reuse `create_booking` tool + TeleCRM sync on success | Booking → TeleCRM push |
| Test console for booking | Dry-run in admin |

**Exit criteria:** Customer messages "book Swift service" → Booking Bot handles end-to-end → booking created → TeleCRM updated.

---

### Phase 2 — Follow-up Bot (Week 3)

| Task | Output |
|------|--------|
| `followup/triggers.ts` — wire telecaller_follow_ups, service_due, CSE | Trigger mapping |
| `followup/handler.ts` — scheduled check-in messages | Outbound AI messages |
| Cron route `/api/cron/whatsapp-agents` | Picks due follow-ups |
| FollowupAgentPanel UI | Trigger toggles, schedule config |
| Session window compliance | Template fallback outside 24h |
| Link to existing `whatsapp_automation_settings` | Reuse template names where applicable |

**Exit criteria:** Telecaller schedules follow-up → Bot sends WhatsApp at scheduled time → reply routes to Booking Bot or human.

---

### Phase 3 — Chase Bot (Week 4–5)

| Task | Output |
|------|--------|
| `chase/handler.ts` — proactive multi-day loop | Core chase logic |
| `chase/scheduler.ts` — wakeup queue processor | Retry scheduling |
| TeleCRM webhook `/api/webhooks/telecrm` | New lead → Chase instance |
| Chase config API + ChaseAgentPanel UI | Goal prompt, rules, TeleCRM triggers |
| Memory service — summary, intent, sentiment | Per-lead memory updates |
| `ACTIVATE_BOOKING_BOT` handoff | Chase → Booking transition |
| AgentLeadsDashboard | Active chase leads table |
| Analytics API | Conversion, response rate |

**Exit criteria:** TeleCRM lead arrives → Chase Bot messages over 5 days → customer replies → Booking Bot converts → Chase ends with CONVERTED.

---

### Phase 4 — Polish & Production (Week 6)

| Task | Output |
|------|--------|
| Human handoff integration | Low confidence → `whatsapp_chat_assignments` |
| Audit log viewer in admin | Action history per instance |
| Error handling + retry for failed sends | Resilience |
| Rate limiting on cron | Prevent burst sends |
| Admin analytics dashboard | Charts in bot-flow page |
| Documentation + runbook | Enable checklist for production |

**Exit criteria:** All 3 bots running in production, monitored, with admin visibility.

---

### Priority Order

```
Phase 0 (foundation)
    ↓
Phase 1 (Booking Bot)     ← most value, ~70% already exists
    ↓
Phase 3 (Chase Bot)       ← highest business impact (new capability)
    ↓
Phase 2 (Follow-up Bot)   ← extends existing telecaller workflows
    ↓
Phase 4 (polish)
```

---

### Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| WhatsApp 24h window blocks outbound | `sessionWindow.ts` + template reopen (existing) |
| AI sends inappropriate messages | Rule engine + blocked words + confidence threshold |
| Duplicate agents on same phone | Unique constraint on active instances |
| TeleCRM sync failures | Retry queue + audit in `whatsapp_agent_actions` |
| Cron missed wakeups | `wake_at` index + catch-up on next cron run |
| Cost (OpenAI calls) | `gpt-4o-mini` default for Chase/Follow-up; gpt-4o for Booking |

---

## Appendix: Default Prompts (Seed Data)

### Booking Bot

```
You are MyFNG Booking Assistant on WhatsApp. Help the customer complete a service booking.

Steps: 1) Get car model + pincode  2) Show pricing  3) Confirm service type  4) Get preferred date  5) Create booking.

Keep replies under 900 characters. No markdown **. Use tools for pricing and booking.
If customer asks about RSA/towing, hand off to human immediately.
```

### Follow-up Bot

```
You are MyFNG Follow-up Assistant. Send a single gentle check-in message.

Context: A follow-up was scheduled. Remind the customer about their pending action (callback, quotation, service due).

Keep it short, friendly, one question. Do not be pushy.
```

### Chase Bot

```
You are MyFNG Sales Follow-up Agent. Your goal: convert this lead into a booked service.

The customer showed interest but has not booked yet. Follow up persistently but politely.

Rules:
- Never send more than one message per attempt
- Increase urgency gradually (info → slot offer → limited offer)
- If customer shows buying intent, activate booking bot
- If customer says stop/unsubscribe, end immediately
- If angry or requests human, escalate
```

---

*Document version: 1.0 — 2026-07-14*
*Next step: Run Phase 0 implementation after review.*
