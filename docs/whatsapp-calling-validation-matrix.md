# WhatsApp Calling Validation Matrix

## Preconditions
- `WHATSAPP_CALLING_ENABLED=1`
- `WHATSAPP_CALLING_FULL_SIGNALING=1`
- `ASTERISK_BRIDGE_INTERNAL_URL` and `ASTERISK_WEBHOOK_SECRET` configured
- Migration `database/205_whatsapp_call_sessions.sql` applied

## Health Checks
- `GET /api/whatsapp/calls/health` returns `success: true`
- `GET /api/internal/asterisk/health` with header `x-asterisk-webhook-secret` returns `success: true`

## End-to-End Scenarios

### 1) Outbound call accepted
1. Trigger call from chat header.
2. Submit offer via `POST /api/whatsapp/calls/{id}/session`.
3. Submit answer via `POST /api/whatsapp/calls/{id}/session`.
4. Verify:
   - `whatsapp_call_logs.call_status` transitions to `ACCEPTED`
   - `whatsapp_call_sessions.session_state` becomes `CONNECTED`
   - UI call state chip updates in realtime

### 2) Outbound call rejected/failed
1. Trigger call.
2. Force provider/bridge rejection.
3. Verify:
   - `whatsapp_call_logs.call_status` is `FAILED` or `REJECTED`
   - `error_message` and provider details shown in UI

### 3) Inbound call answered/missed
1. Receive webhook with `INBOUND` call event.
2. Verify `whatsapp_call_logs` upsert.
3. For answered case, verify session upsert and state `CONNECTED`.
4. For missed case, verify status `MISSED`.

### 4) Callback request flow
1. Trigger callback from UI.
2. Verify `CALLBACK_REQUESTED` entry.
3. On follow-up call event, verify final status and session records.

### 5) Call controls
1. Execute `hold`, `resume`, `mute`, `unmute`, `hangup` from UI.
2. Verify:
   - `whatsapp_call_control_audit` row per action
   - hangup sets `whatsapp_call_logs.call_status=ENDED`
   - session state updates to `ENDED` on hangup

### 6) Recording access
1. Confirm webhook inserts `whatsapp_call_recordings`.
2. Open recording via `/api/whatsapp/calls/recordings/{id}`.
3. Verify redirect works only for authenticated/authorized roles.

## Realtime Verification
- Open the same chat in two tabs.
- Trigger call/session/control updates.
- Verify both tabs update without manual refresh.

## Rollback Safety
- Set `WHATSAPP_CALLING_FULL_SIGNALING=0` to disable strict signaling guard.
- Keep callback flow available while signaling stack is unavailable.
