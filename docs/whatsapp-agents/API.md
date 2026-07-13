# WhatsApp Agents — API Reference

Base URL: `/api/whatsapp/agents`
Auth: Supabase session + `SUPER_ADMIN` or `SUB_ADMIN` role (except cron/webhooks).

---

## Config Endpoints

### Booking Agent

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/booking/config` | Get config + runtime status |
| `PATCH` | `/booking/config` | Update config (partial) |

### Follow-up Agent

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/followup/config` | Get config + runtime status |
| `PATCH` | `/followup/config` | Update config (partial) |

### Chase Agent

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/chase/config` | Get config + runtime status |
| `PATCH` | `/chase/config` | Update config (partial) |
| `GET` | `/chase/leads` | Active chase instances with CRM data |

---

## Instance Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/instances` | List instances (filterable) |
| `GET` | `/instances/:id` | Instance detail + memory + actions |
| `POST` | `/instances/:id/trigger` | Manual trigger |
| `POST` | `/instances/:id/pause` | Pause instance |
| `POST` | `/instances/:id/escalate` | Force human handover |

### `GET /instances` Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `agent_type` | string | `BOOKING` \| `FOLLOWUP` \| `CHASE` |
| `status` | string | `ACTIVE` \| `WAITING` \| `PAUSED` \| `ESCALATED` \| `ENDED` |
| `phone` | string | Filter by phone |
| `lead_id` | uuid | Filter by lead |
| `page` | number | Page number (default 1) |
| `limit` | number | Page size (default 20, max 100) |

---

## Test Endpoint

### `POST /test`

Dry-run agent decision without sending messages.

**Request:**

```json
{
  "agent_type": "CHASE",
  "phone": "9876543210",
  "event_type": "SCHEDULED_WAKEUP",
  "mock_memory": {
    "buying_intent": "HIGH",
    "sentiment": "NEUTRAL",
    "conversation_summary": "Customer asked about Swift periodic service pricing 2 days ago."
  },
  "mock_crm": {
    "name": "Rahul",
    "vehicle_model": "Swift",
    "city": "Mumbai",
    "disposition": "Interested"
  }
}
```

**Response:**

```json
{
  "success": true,
  "decision": {
    "action": "SEND_MESSAGE",
    "message": "Hi Rahul, Swift ki periodic service ke liye is Thursday slot available hai. Book karein?",
    "wait_days": 2,
    "confidence": 0.91,
    "reason": "Lead showed interest 48h ago, no reply since."
  },
  "validation": {
    "passed": true,
    "checks": ["agent_enabled", "within_business_hours", "under_max_follow_ups"]
  },
  "would_execute": true,
  "latency_ms": 1240
}
```

---

## Analytics Endpoint

### `GET /analytics`

**Query:** `agent_type`, `from` (ISO date), `to` (ISO date)

**Response:**

```json
{
  "period": { "from": "2026-07-01", "to": "2026-07-14" },
  "booking": {
    "conversations": 120,
    "bookings_created": 34,
    "conversion_rate": 0.283,
    "avg_messages_to_book": 6.2
  },
  "followup": {
    "sent": 89,
    "replied": 41,
    "response_rate": 0.461,
    "completed": 35
  },
  "chase": {
    "active": 23,
    "converted": 8,
    "escalated": 3,
    "ended_max_attempts": 5,
    "avg_follow_ups_to_convert": 3.1
  }
}
```

---

## Cron Endpoint

### `GET /api/cron/whatsapp-agents`

**Auth:** `Authorization: Bearer {CRON_SECRET}`

Processes:
1. Due scheduled wakeups (`whatsapp_agent_scheduled_wakeups`)
2. New TeleCRM leads for Chase Bot
3. Due telecaller follow-ups for Follow-up Bot

**Response:**

```json
{
  "processed_wakeups": 5,
  "new_chase_instances": 2,
  "followup_triggers": 3,
  "errors": []
}
```

---

## Webhook Extensions

### `POST /api/webhooks/whatsapp` (existing, extended)

No API change. Internal routing extended:

1. Check active Booking instance → `booking/handler.ts`
2. Check active Chase instance → `chase/handler.ts`
3. Default → existing `brain.ts`

### `POST /api/webhooks/telecrm` (new)

**Auth:** `X-Webhook-Secret: {TELECRM_WEBHOOK_SECRET}`

**Request:**

```json
{
  "phone": "+919876543210",
  "name": "Rahul",
  "disposition": "Interested",
  "vehicle_model": "Swift",
  "city": "Mumbai",
  "service_type": "Periodic Service"
}
```

**Response:**

```json
{
  "success": true,
  "chase_instance_created": true,
  "instance_id": "uuid"
}
```

---

## AI Decision Schema

All agents return this JSON structure from the LLM:

```typescript
type AgentDecision = {
  action:
    | 'SEND_MESSAGE'
    | 'WAIT'
    | 'UPDATE_CRM'
    | 'ASSIGN_TO_HUMAN'
    | 'BOOK_APPOINTMENT'
    | 'END_CONVERSATION'
    | 'ACTIVATE_BOOKING_BOT';

  // SEND_MESSAGE
  message?: string;

  // WAIT
  wait_hours?: number;
  wait_days?: number;

  // UPDATE_CRM
  crm_fields?: Record<string, string>;

  // ASSIGN_TO_HUMAN
  assign_reason?: string;

  // BOOK_APPOINTMENT
  booking_details?: {
    car_model?: string;
    pincode?: string;
    service_type?: string;
    preferred_date?: string;
  };

  // END_CONVERSATION
  end_reason?: string;

  // Always required
  confidence: number;  // 0.0 – 1.0
  reason: string;
};
```

### Action Execution Matrix

| Action | Executed by | Side effects |
|--------|-------------|--------------|
| `SEND_MESSAGE` | `whatsappService.sendTextMessage` | `follow_up_count++`, log to `whatsapp_messages` |
| `WAIT` | Scheduler | Create `scheduled_wakeups` row, status → `WAITING` |
| `UPDATE_CRM` | `telecrm/push.ts` | Update `telecrm_api` + push to TeleCRM |
| `ASSIGN_TO_HUMAN` | `handoff.ts` | Create `whatsapp_chat_assignments`, status → `ESCALATED` |
| `BOOK_APPOINTMENT` | `chatbot_v2/booking.ts` | Create booking + TeleCRM sync |
| `END_CONVERSATION` | Instance update | status → `ENDED`, set `end_reason` |
| `ACTIVATE_BOOKING_BOT` | Instance create | Create Booking instance, pause Chase |

---

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | Not SUPER_ADMIN / SUB_ADMIN |
| 404 | `INSTANCE_NOT_FOUND` | Invalid instance ID |
| 409 | `INSTANCE_ALREADY_ACTIVE` | Duplicate active instance for phone+type |
| 422 | `VALIDATION_FAILED` | Invalid config or decision JSON |
| 503 | `AGENT_DISABLED` | Agent type not enabled in config |

---

*See `ARCHITECTURE.md` for full system design and roadmap.*
