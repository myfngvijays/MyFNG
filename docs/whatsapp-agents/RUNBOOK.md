# WhatsApp Agents — Production Runbook

## Pre-flight checklist

| Step | Action |
|------|--------|
| 1 | Run SQL migrations `260` through `267` in Supabase |
| 2 | Set credentials: Bot Flow → **API Keys** tab (or server `.env` fallback) |
| 3 | Meta templates approved: `lead_enquiry_account_update` (Chase), `app_session_incomplete` (Follow-up) |
| 4 | Bot Flow → enable each agent + Save |
| 5 | Vercel cron active: `*/10 * * * *` → `/api/cron/whatsapp-agents` |
| 6 | Test: Run Chase Now + Run Follow-up Now from admin |

---

## Agent enable order (recommended)

1. **Booking Bot** — inbound, highest value
2. **Chase Bot** — TeleCRM new leads
3. **Follow-up Bot** — telecaller follow-ups + incomplete bookings

Keep **AI Brain** enabled as fallback for unhandled inbound messages.

---

## Outbound templates

| Bot | Config key | Template |
|-----|------------|----------|
| Chase | `outbound_template_name` | `lead_enquiry_account_update` |
| Follow-up | `outbound_template_name` | `app_session_incomplete` |

When WhatsApp 24h window is closed, bots send the Meta template (customer name in `{{1}}`). When open, AI sends free text.

**Template sync:** Use **Sync** on WhatsApp Templates page. Local bot templates are protected and will not be auto-deleted.

---

## Cron jobs

```
GET /api/cron/whatsapp-agents?job=all
Authorization: Bearer {CRON_SECRET}
```

Runs every 10 minutes (Vercel). Jobs:

| Job | What |
|-----|------|
| `chase-wakeups` | Due chase retries |
| `chase-telecrm` | New TeleCRM leads (48h lookback) |
| `followup-triggers` | Telecaller / booking / CSE / service due |
| `followup-wakeups` | Scheduled follow-up wakeups |
| (auto) | Recover stuck wakeups (PROCESSING > 15 min) |

**VPS fallback** (if not on Vercel):

```bash
*/10 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://myfng.in/api/cron/whatsapp-agents
```

---

## Monitoring

**Admin UI:** Bot Flow → **Monitoring** tab

- Analytics (14-day): conversions, response rates, failed sends
- Audit log: last 40 agent actions

**System Monitor:** Super Admin → System Monitor → **WhatsApp AI Agents** health check

**Full usage guide:** [`USER_GUIDE.md`](./USER_GUIDE.md)

**APIs:**

- `GET /api/whatsapp/agents/analytics`
- `GET /api/whatsapp/agents/actions`
- `GET /api/whatsapp/agents/instances/:id`

---

## Human handoff

Triggers:

- AI confidence below threshold → `ASSIGN_TO_HUMAN`
- Customer angry / requests human
- RSA/towing in Booking Bot

Creates row in `whatsapp_chat_assignments`. Agents skip phones with active human assignment when `skip_assigned_chats` is enabled.

---

## Failure recovery

| Failure | Auto recovery |
|---------|---------------|
| WhatsApp send failed | Retry wakeup in 15 min (max 2×) |
| Wakeup stuck PROCESSING | Reset to PENDING after 15 min |
| TeleCRM sync failed | Logged in `whatsapp_agent_actions` — retry manually |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No outbound messages | Check template Meta Approved + agent enabled |
| Template missing after Sync | Re-run `266_restore_lead_template.sql`; Sync no longer deletes protected templates |
| Chase not triggering | Enable Chase Bot; check TeleCRM webhook / Sarv insert |
| Follow-up not sending | Enable Follow-up Bot; telecaller follow-up must be PENDING + past `scheduled_time` |
| Customer not getting AI reply | Check 24h window; verify `OPENAI_API_KEY` |

---

## Safe rollout

1. Enable **Booking Bot** only → test inbound booking for 2–3 days
2. Enable **Chase Bot** with `max_follow_ups: 3` initially
3. Enable **Follow-up Bot** with telecaller trigger only
4. Review Monitoring tab daily for failed sends / blocked actions
5. Increase limits after 1 week stable

---

*Last updated: 2026-07-14 — Phase 4*
