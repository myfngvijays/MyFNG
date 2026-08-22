import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeWebhookPayload,
  upsertSmartfloRecording,
} from '@/lib/telecaller/smartfloCdr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Smartflo hangup webhook → save recording_url onto CRM call logs.
 *
 * Configure in Smartflo → Webhooks:
 *   Event: Call hangup (Missed or Answered)
 *   URL:   https://www.myfng.in/api/webhooks/smartflo
 *   Auth (optional): Authorization: Bearer <SMARTFLO_WEBHOOK_SECRET>
 *                    or ?secret=<SMARTFLO_WEBHOOK_SECRET>
 *
 * Include variables: $call_id / $uuid, $recording_url, $customer_number_with_prefix,
 * $call_duration, $did_number, $direction, $status / $hangup_cause
 */
function assertWebhookAuth(req: NextRequest): boolean {
  const secret = String(process.env.SMARTFLO_WEBHOOK_SECRET || '').trim();
  if (!secret) return true; // open if no dedicated webhook secret (CDR poll still works)

  const header = req.headers.get('x-webhook-secret') || '';
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const q = new URL(req.url).searchParams.get('secret') || '';
  return header === secret || bearer === secret || q === secret;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/smartflo',
    purpose: 'Receive Smartflo Call hangup events and attach recording_url to MyFNG call logs',
    auth: 'Optional: Authorization Bearer SMARTFLO_WEBHOOK_SECRET (or ?secret=)',
    smartflo_setup: {
      event: 'Call hangup (Missed or Answered)',
      method: 'POST',
      url: 'https://www.myfng.in/api/webhooks/smartflo',
      suggested_body: {
        call_id: '$uuid',
        recording_url: '$recording_url',
        client_number: '$customer_number_with_prefix',
        did_number: '$caller_id_number',
        call_duration: '$call_duration',
        status: '$hangup_cause',
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
        // Smartflo sometimes posts raw querystring-like bodies
        const params = new URLSearchParams(text);
        params.forEach((v, k) => {
          body[k] = v;
        });
      }
    }

    const rec = normalizeWebhookPayload(body);
    if (!rec) {
      return NextResponse.json(
        {
          error: 'Missing call_id / recording_url / client_number',
          received_keys: Object.keys(body || {}),
        },
        { status: 400 },
      );
    }

    const result = await upsertSmartfloRecording(rec, 'webhook');

    return NextResponse.json({
      success: true,
      call_id: rec.call_id || rec.uuid || null,
      has_recording: result.hasRecording,
      lead_id: result.leadId,
      call_log_id: result.callLogId,
      recording_row_id: result.recordingRowId,
      updated_log: result.updatedLog,
      created_log: result.createdLog,
    });
  } catch (e: any) {
    console.error('[webhooks/smartflo]', e);
    return NextResponse.json(
      { error: e?.message || 'Webhook handler failed' },
      { status: 500 },
    );
  }
}
