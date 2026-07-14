# MyFNG WhatsApp Agents — Complete User Guide

> **Kahan se manage karein:** Super Admin → **Bot Flow** (`/dashboard/super_admin/bot-flow`)  
> **Scope:** Internal MyFNG only (SaaS nahi). TeleCRM + WhatsApp + OpenAI integrated.

---

## 1. Kya build hua hai? (Overview)

MyFNG mein **4 AI systems** ek saath kaam karte hain:

| System | Tab name | Kya karta hai | Direction |
|--------|----------|---------------|-----------|
| **AI Brain** | AI Brain | Har inbound WhatsApp message ka router — AI ya published flow | Inbound |
| **MISA AI** | MISA AI | Booking complete karta hai (car, pincode, pricing, OTP, slot) | Inbound |
| **Follow-up Bot** | Follow-up Bot | Ek gentle check-in — telecaller / incomplete booking / service due | Outbound |
| **Chase Bot** | Chase Bot | TeleCRM lead ko persistently follow-up until book / max attempts | Outbound |

**Core rule:** Chase aur Follow-up → AI sirf **JSON decision** return karta hai → **Rule Engine** validate → phir send. MISA AI tool-calling use karta hai (alag pipeline).

```
Customer WhatsApp
       ↓
   AI Brain (router)
       ├── MISA AI (booking intent)
       ├── Published Flow
       └── Fallback message

TeleCRM / Cron / Admin
       ↓
   Chase Bot / Follow-up Bot
       → OpenAI JSON decision
       → Rule Engine
       → WhatsApp send / WAIT / Escalate
```

---

## 2. Bot Flow UI — 5 Tabs

### Tab 1: AI Brain
- **Purpose:** Pehla gate — koi bhi customer message aaye to Brain decide karta hai AI reply ya flow.
- **Configure:** Mode (AI_FIRST / FLOW_FIRST / HYBRID), model, active flow, tools, session window, reopen template.
- **Test:** Header mein **Test Brain** button → dry-run modal.

### Tab 2: MISA AI (Booking)
- **Purpose:** MyFNG Instant Service Assistant — full booking on WhatsApp.
- **Flow:** Car model → pincode → pricing → vehicle number → name → phone OTP → address → date → create booking.
- **Lead source labels:** WhatsApp MISA AI / MISA AI (Website) / MISA AI (App).
- **Test:** **Test MISA AI** → multi-turn chat modal with Reset.

### Tab 3: Follow-up Bot
- **Purpose:** Scheduled one-shot check-ins (not persistent chase).
- **Auto triggers:**
  - Telecaller scheduled follow-up (PENDING + past time)
  - Incomplete booking (2h idle draft)
  - Service due reminder
  - CSE callback
- **Manual:** **Send Follow-up to Number** — live WhatsApp (not dry-run).
- **List:** **Active Follow-up Instances** table with Pause / Escalate.
- **Test:** **Test Follow-up Bot** → dry-run JSON decision only.

### Tab 4: Chase Bot (screenshot wala panel)
- **Purpose:** TeleCRM leads ko convert karna — multi-day persistent outreach.
- **Auto triggers:**
  - Sarv call → `telecrm_api` insert → instant chase
  - Cron every 10 min — new leads + due wakeups
  - TeleCRM webhook `POST /api/webhooks/telecrm`
- **Manual:** **Run Chase Now** button.
- **List:** **Active Chase Leads** table with Pause / Escalate.
- **Test:** **Test Chase Bot** → dry-run.

### Tab 5: Monitoring
- 14-day analytics (conversions, response rate, failed sends)
- Audit log — last 40 agent actions
- APIs: `/api/whatsapp/agents/analytics`, `/actions`

---

## 3. Har bot ka config panel (screenshot jaisa)

Har agent panel mein same structure hai:

### Left column — AI settings
| Field | Meaning |
|-------|---------|
| **Model** | `gpt-4o-mini` (recommended) or `gpt-4o` |
| **Goal Prompt** | Bot ki personality + objective (Chase: convert lead, Follow-up: one check-in) |
| **Channel Add-on** | WhatsApp limits — char count, one question per message |
| **Fallback Message** | Jab AI fail ho |

### Right column — Rules
| Rule | Default (Chase) | Meaning |
|------|-----------------|--------|
| Max follow-ups | 5 | Kitni baar message bhej sakta hai |
| Min wait hours | 24 | Messages ke beech minimum gap |
| Max daily messages | 2 | Ek din mein max outbound |
| Business hours | 09:00–20:00 IST | Iske bahar send block |
| DND hours | 21:00–08:00 | Night block |
| Confidence threshold | 0.7 | Isse kam confidence → escalate |
| Skip assigned chats | ✅ | Human assigned ho to bot skip |

### Triggers (bot-specific)
**Chase Bot:**
- `telecrm_new_lead` — naya TeleCRM lead
- `no_reply_hours` — 48h no reply → retry
- `cold_lead_days` — 3 days cold
- `outbound_template_name` — `lead_enquiry_account_update` (24h+ window)

**Follow-up Bot:**
- `telecaller_follow_up` + offset minutes
- `incomplete_booking` + delay hours (default 2h)
- `service_due_reminder`, `cse_callback`
- `outbound_template_name` — `app_session_incomplete`

### Enable + Save
- Green **Enabled** toggle → **Save** dabao. Bina save ke cron/API use nahi karega.

---

## 4. Active Instances — Pause / Escalate

**Kya hai "Active instances"?**  
`whatsapp_agent_instances` table mein `ACTIVE` ya `WAITING` status wale open sessions.

**Kahan dikhte hain:**
- Config panel badge: `Active instances: 5`
- Table: Chase tab → Active Chase Leads | Follow-up tab → Active Follow-up Instances

**Actions per row:**

| Button | API | Kya hota hai |
|--------|-----|--------------|
| **Pause** | `POST /instances/:id/pause` | Status `PAUSED`, wakeups cancel |
| **Escalate** | `POST /instances/:id/escalate` | Human handoff + TeleCRM escalation sync |

**Instance statuses:** `ACTIVE` → `WAITING` (scheduled) → `PAUSED` / `ESCALATED` / `ENDED`

---

## 5. Test buttons (header)

Har tab pe sirf **ek** test button — toggle se modal band hota hai.

| Tab | Button | Modal | Live send? |
|-----|--------|-------|------------|
| AI Brain | Test Brain | Brain test | No |
| MISA AI | Test MISA AI | Chat bubbles + session | Dry-run only |
| Follow-up | Test Follow-up Bot | JSON decision preview | No |
| Chase | Test Chase Bot | JSON decision preview | No |

**Live send ke liye:** Follow-up tab → **Send Follow-up to Number** (real WhatsApp).

---

## 6. Manual Follow-up demo

**UI:**
1. Follow-up Bot tab
2. Phone field (10 digit, e.g. `9167456023`)
3. **Send Follow-up** → live message

**API:**
```http
POST /api/whatsapp/agents/followup/trigger
Content-Type: application/json

{
  "phone": "9167456023",
  "reason": "Car service follow-up check-in",
  "force": true
}
```

**CLI (dev):**
```bash
cd apps/web
npx tsx scripts/triggerFollowupByPhone.ts 9167456023
```

**Important:**
- Har trigger = **ek message**, phir instance END
- Har baar **alag wording** (AI variety + prior messages avoid)
- Numbers jo `91` se start hote hain (e.g. `9167456023`) → system ab `919167456023` banata hai (fix applied)
- Bahut baar rapid click mat karo — Meta "healthy ecosystem" block kar sakta hai

---

## 7. Chase Bot — pura flow

```
TeleCRM new lead (Sarv / webhook / cron poll)
        ↓
shouldChaseTelecrmLead() — disposition eligible?
        ↓
createChaseInstanceFromTelecrmLead()
        ↓
processChaseAgentEvent(NEW_LEAD)
        ↓
OpenAI JSON → SEND_MESSAGE / WAIT / ACTIVATE_BOOKING_BOT / ...
        ↓
Rule Engine → execute
        ↓
No reply 48h → SCHEDULED_WAKEUP → retry (max 5)
        ↓
Booking intent → handoff MISA AI → instance CONVERTED
```

**Run Chase Now:** Due wakeups + 48h TeleCRM scan (same as cron).

**Active Chase Leads table:** Phone, status, follow-ups, buying intent, next wakeup, Pause/Escalate.

---

## 8. Follow-up Bot — pura flow

```
Trigger source (cron / manual)
        ↓
createFollowupInstance (one per source_id)
        ↓
processFollowupAgentEvent(FOLLOWUP_TRIGGER)
        ↓
AI → SEND_MESSAGE (one short check-in)
        ↓
Instance END (reason: MANUAL)
```

**Customer reply with booking intent** → MISA AI handoff, chase/follow-up end.

**Auto sources (cron `followup-triggers`):**
- `telecaller_follow_ups` — PENDING + scheduled_time passed
- `booking_drafts` — ACTIVE + 2h idle
- Service due, CSE callbacks (if enabled in triggers)

---

## 9. MISA AI — booking flow

```
Inbound WhatsApp → Brain routes to MISA
        ↓
Tools: pricing, workshops, service_details, booking
        ↓
send_booking_otp → verify_booking_otp (dry-run: 000000)
        ↓
create_booking (needs vehicle_number + verified phone)
        ↓
Lead source: WhatsApp MISA AI / Website / App
```

**Test modal:** Multi-turn chat, session persist, Reset button.

---

## 10. CRM_UPDATE auto re-run

Jab TeleCRM disposition change hoti hai (DB trigger / new row):

1. Active Chase/Follow-up instance pe `CRM_UPDATE` event
2. Memory `crm_snapshot` refresh
3. AI dubara decide karta hai (e.g. disposition "Not Interested" → END)

**Cron poll:** Har 10 min `crmUpdates` job — last 15 min disposition changes.

---

## 11. Cron job

```http
GET /api/cron/whatsapp-agents?job=all
Authorization: Bearer {CRON_SECRET}
```

| Job param | Kya karta hai |
|-----------|---------------|
| `all` | Sab (default) |
| `chase-wakeups` | Due chase retries |
| `chase-telecrm` | New TeleCRM leads |
| `followup-triggers` | Telecaller / booking / CSE / service |
| `followup-wakeups` | Scheduled follow-up wakeups |
| `crm-updates` | Disposition change re-run |

Vercel: `*/10 * * * *` → `/api/cron/whatsapp-agents`

---

## 12. System Monitor integration

**Super Admin → System Monitor** mein naya check:

**WhatsApp AI Agents** (AI category)
- Enabled agents list
- Active instances: BOOKING / FOLLOWUP / CHASE counts
- Pending / stuck wakeups
- Deployed capabilities list
- Quick link: Open Bot Flow

---

## 13. Database migrations (production)

Supabase SQL Editor mein run karo (order matters):

```
database/260_whatsapp_agents.sql      — core tables + seed configs
database/261_whatsapp_agents_rls.sql (if separate)
...
database/267_whatsapp_agents_phase4.sql — phase 4 indexes
```

Tables:
- `whatsapp_agent_configs` — bot settings
- `whatsapp_agent_instances` — per-phone sessions
- `whatsapp_agent_memory` — AI context
- `whatsapp_agent_actions` — audit log
- `whatsapp_agent_scheduled_wakeups` — cron wakeups

---

## 14. Environment variables (API Keys)

**Recommended:** Bot Flow → **API Keys** tab (Firebase Settings jaisa).

| Step | Kya karna hai |
|------|----------------|
| 1 | **Auto-fill from server** — server `.env` se keys DB mein copy |
| 2 | **Use saved credentials** ON karo — redeploy ki zaroorat nahi |
| 3 | **Test Connection** — OpenAI + WhatsApp + Cron check |
| 4 | **Save credentials** |

| Variable | Required for | Admin panel |
|----------|--------------|-------------|
| `OPENAI_API_KEY` | All AI bots | Editable |
| `WHATSAPP_ACCESS_TOKEN` | Send messages | Editable |
| `WHATSAPP_PHONE_NUMBER_ID` | Send messages | Editable |
| `CRON_SECRET` | Cron auth | Editable |
| `TELECRM_WEBHOOK_SECRET` | TeleCRM webhook | Editable |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB ops | **Server .env only** (read-only status) |

**Migration:** `database/268_whatsapp_agents_env_config.sql` production Supabase par run karo.

**Fallback:** Agar DB empty hai ya "Use saved credentials" OFF hai → server `.env` use hota hai (purana behaviour).

---

## 15. TeleCRM stage → different messages

Bot Flow → **Chase Bot** → **TeleCRM Stage → WhatsApp Messages**

Har TeleCRM field ke liye alag rule set karo:

| Setting | Example |
|---------|---------|
| **Stage** | `Interested`, `Follow-up`, `Not Interested` |
| **Bot** | Chase / Follow-up / None |
| **Message type** | AI prompt / Fixed text / Meta template |
| **Trigger** | New lead / Stage change / Both |

**Examples (default rules):**
- `Interested` → Chase Bot + AI message
- `Follow-up` → Follow-up Bot + AI callback reminder
- `Attempted Contact` → Fixed: "Hi {{name}}, we tried reaching you..."
- `Not Interested` / `DO NOT CALL` → Stop all bots, no message

Stage change TeleCRM se aate hi trigger hota hai (webhook + cron CRM poll).

---

## 16. Outbound templates (24h window)

WhatsApp **24 hour rule:** Customer ne 24h mein message nahi kiya → sirf **approved Meta template** bhej sakte ho.

| Bot | Template (default) | Free text kab |
|-----|-------------------|---------------|
| Chase | `lead_enquiry_account_update` | Session open (customer ne recently message kiya) |
| Follow-up | `app_session_incomplete` | Session open |

Template sync: **WhatsApp Templates** page → Sync (protected templates delete nahi hote).

---

## 17. Safe rollout order

1. **MISA AI** enable → 2–3 din inbound booking test
2. **Chase Bot** enable, `max_follow_ups: 3` se start
3. **Follow-up Bot** enable, telecaller trigger only
4. **Monitoring** tab daily check — failed sends, blocked actions
5. 1 week stable → limits badhao

---

## 18. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| UI "sent" but phone pe nahi aaya | Purana phone bug (`91xxxx` numbers) ya Meta delivery fail | Restart server; ek baar send; check `whatsapp_messages.status` |
| "healthy ecosystem engagement" | Bahut saare similar outbound ek saath | 1 message per number per day max; gap rakho |
| Follow-up list empty but badge 5 | API bug (fixed) | Refresh; `/followup/leads` ab sahi query karta hai |
| Chase nahi chal raha | Disabled / disposition not eligible | Enable + check TeleCRM disposition |
| `chat_assigned_to_human` | Human already assigned | Escalate flow theek hai; manual demo `force: true` use karta hai |
| Second follow-up error `end_reason` | Invalid DB value (fixed) | Ab `MANUAL` use hota hai |
| Prime membership random message | AI guess without context (fixed) | Prompt + prior message avoid; car service focus |
| Template send fail | Meta not approved | WhatsApp Templates → approve status check |

**Debug script:**
```bash
node apps/web/scripts/debugFollowupSend.mjs 9167456023
```
→ instances, actions, `whatsapp_messages` status dikhata hai.

---

## 19. API quick reference

Base: `/api/whatsapp/agents` (Super Admin auth)

| Endpoint | Method | Use |
|----------|--------|-----|
| `/booking/config` | GET/PATCH | MISA AI config |
| `/followup/config` | GET/PATCH | Follow-up config |
| `/chase/config` | GET/PATCH | Chase config |
| `/chase/leads` | GET | Active chase instances |
| `/followup/leads` | GET | Active follow-up instances |
| `/followup/trigger` | POST | Manual live follow-up |
| `/followup/run-now` | POST | Cron triggers now |
| `/chase/run-now` | POST | Chase cron now |
| `/instances/:id/pause` | POST | Pause instance |
| `/instances/:id/escalate` | POST | Human handoff |
| `/instances/:id` | GET | Detail + memory + actions |
| `/test` | POST | Dry-run decision |
| `/analytics` | GET | 14-day stats |
| `/actions` | GET | Audit log |

Full API: [`API.md`](./API.md)  
Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
Ops runbook: [`RUNBOOK.md`](./RUNBOOK.md)

---

## 20. File map (developers)

```
apps/web/src/lib/whatsappAgents/     — core engine
apps/web/src/app/api/whatsapp/agents/ — REST APIs
apps/web/src/app/dashboard/super_admin/bot-flow/ — admin UI
apps/web/scripts/triggerFollowupByPhone.ts — CLI demo send
apps/web/scripts/debugFollowupSend.mjs — debug delivery
database/260-267_whatsapp_agents*.sql — migrations
docs/whatsapp-agents/ — this guide + architecture + API + runbook
```

---

## 20. Daily ops checklist

- [ ] Bot Flow → har enabled agent pe **Active instances** normal range?
- [ ] Monitoring tab → failed sends = 0?
- [ ] System Monitor → WhatsApp AI Agents healthy?
- [ ] Cron logs (Vercel) → `whatsapp-agents` 200 every 10 min?
- [ ] TeleCRM dispositions syncing (Chase CRM_UPDATE)?

---

*Last updated: 14 Jul 2026 — includes Pause/Escalate, instance dashboards, CRM_UPDATE poll, manual follow-up trigger, message variety, phone normalization fix, System Monitor check.*
