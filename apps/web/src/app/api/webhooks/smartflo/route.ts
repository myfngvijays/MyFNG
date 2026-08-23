import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeWebhookPayload,
  upsertSmartfloRecording,
} from '@/lib/telecaller/smartfloCdr';
import { applyWebhookToDialSession } from '@/lib/telecaller/smartfloDialSessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Smartflo webhooks → live dial session + hangup recordings.
 *
 * Configure in Smartflo → Webhooks (same URL for all):
 *   https://www.myfng.in/api/webhooks/smartflo
 *
 * Recommended triggers for live dialer UI:
 *   - Call answered by Customer (Click to call)  → ANSWERED + timer starts
 *   - Call hangup (Missed or Answered)           → ENDED + recording
 *   - Dialed on Agent / Call answered by Agent   → RINGING / ANSWERED (optional)
 *
 * Auth (optional): Authorization: Bearer <SMARTFLO_WEBHOOK_SECRET>
 */
function assertWebhookAuth(req: NextRequest): boolean {
  const secret = String(process.env.SMARTFLO_WEBHOOK_SECRET || '').trim();
  if (!secret) return true;

  const header = req.headers.get('x-webhook-secret') || '';
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const q = new URL(req.url).searchParams.get('secret') || '';
  return header === secret || bearer === secret || q === secret;
}

async function parseBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') || '';
  let body: Record<string, unknown> = {};

  if (contentType.includes('application/json')) {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  } else if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData().catch(() => null);
    if (form) {
      form.forEach((v, k) => {
        body[k] = typeof v === 'string' ? v : String(v);
      });
    }
  } else {
    const text = await request.text().catch(() => '');
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      const params = new URLSearchParams(text);
      params.forEach((v, k) => {
        body[k] = v;
      });
    }
  }
  return body;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/smartflo',
    purpose:
      'Live dial-session updates (ANSWERED/ENDED) + hangup recording attach for MyFNG CRM',
    auth: 'Optional: Authorization Bearer SMARTFLO_WEBHOOK_SECRET (or ?secret=)',
    smartflo_setup: {
      url: 'https://www.myfng.in/api/webhooks/smartflo',
      method: 'POST',
      triggers: [
        'Call answered by Customer (Click to call)',
        'Call hangup (Missed or Answered)',
        'Call answered by Agent',
        'Dialed on Agent',
      ],
      suggested_body: {
        call_id: '$uuid',
        ref_id: '$ref_id',
        recording_url: '$recording_url',
        client_number: '$customer_number_with_prefix',
        agent_number: '$answer_agent_number',
        did_number: '$caller_id_number',
        call_duration: '$call_duration',
        status: '$call_status',
        direction: '$direction',
        end_stamp: '$hangup_time',
      },
    },
  });
}

export async function POST(request: NextRequest) {
  if (!assertWebhookAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await parseBody(request);

    // 1) Live dialer session (mid-call + hangup) — does not require recording_url
    const live = await applyWebhookToDialSession(body).catch((e) => {
      console.warn('[webhooks/smartflo] dial session:', e);
      return { updated: false as const };
    });

    // 2) Recording / CDR attach when payload has enough fields
    const rec = normalizeWebhookPayload(body);
    let recording: Awaited<ReturnType<typeof upsertSmartfloRecording>> | null = null;
    if (rec) {
      recording = await upsertSmartfloRecording(rec, 'webhook');
    }

    if (!live.updated && !recording) {
      return NextResponse.json(
        {
          error: 'No matching dial session and insufficient fields for recording upsert',
          received_keys: Object.keys(body || {}),
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      dial_session: live,
      call_id: rec?.call_id || rec?.uuid || null,
      has_recording: recording?.hasRecording ?? false,
      lead_id: recording?.leadId ?? null,
      call_log_id: recording?.callLogId ?? null,
      recording_row_id: recording?.recordingRowId ?? null,
      updated_log: recording?.updatedLog ?? false,
      created_log: recording?.createdLog ?? false,
    });
  } catch (e: any) {
    console.error('[webhooks/smartflo]', e);
    return NextResponse.json(
      { error: e?.message || 'Webhook handler failed' },
      { status: 500 },
    );
  }
}
