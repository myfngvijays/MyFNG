import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ title?: string; details?: string; code?: number }>;
};

type WhatsAppInboundMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; sha256?: string; caption?: string };
  document?: { id?: string; mime_type?: string; sha256?: string; filename?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  interactive?: unknown;
  button?: unknown;
};

function mapStatus(status: string | undefined): 'SENT' | 'DELIVERED' | 'VIEWED' | 'FAILED' {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'delivered') return 'DELIVERED';
  if (normalized === 'read') return 'VIEWED';
  if (normalized === 'failed' || normalized === 'undelivered') return 'FAILED';
  return 'SENT';
}

function parseIsoTimestamp(unixTimestamp: string | undefined): string | null {
  const ts = Number(unixTimestamp || '');
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

function isSignatureValid(rawBody: string, signatureHeader: string | null): boolean {
  if (!WHATSAPP_APP_SECRET) return true;
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const verifyToken = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (!WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ error: 'Webhook verify token is not configured' }, { status: 500 });
  }

  if (mode === 'subscribe' && verifyToken === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 });
  }

  return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-hub-signature-256');

  if (!isSignatureValid(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const db: any = supabase;
  const now = new Date().toISOString();
  const { data: webhookEvent } = await db
    .from('whatsapp_webhook_events')
    .insert({
      event_type: 'messages',
      payload: body,
      received_at: now,
      process_status: 'RECEIVED',
    })
    .select('id')
    .maybeSingle();

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let updatedCount = 0;
  let skippedCount = 0;
  let inboundCount = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== 'messages') continue;

      const contacts = Array.isArray(change?.value?.contacts) ? change.value.contacts : [];
      const waMetadata = change?.value?.metadata || {};
      const inboundMessages: WhatsAppInboundMessage[] = Array.isArray(change?.value?.messages)
        ? change.value.messages
        : [];

      for (const inbound of inboundMessages) {
        const providerMessageId = String(inbound?.id || '').trim();
        const senderPhone = String(inbound?.from || '').trim() || null;
        const messageType = String(inbound?.type || 'unknown').trim().toLowerCase();
        const statusAt = parseIsoTimestamp(inbound?.timestamp);
        const contactProfile = contacts.find((c: any) => c?.wa_id === inbound?.from);
        const profileName = contactProfile?.profile?.name || null;

        const textBody =
          messageType === 'text'
            ? inbound?.text?.body || null
            : messageType === 'button'
            ? JSON.stringify(inbound?.button || {})
            : null;

        const mediaObj = (inbound as any)?.[messageType] || null;
        const mediaCaption =
          mediaObj && typeof mediaObj === 'object'
            ? mediaObj.caption || null
            : null;

        await db.from('whatsapp_messages').upsert(
          {
            provider_message_id: providerMessageId || null,
            direction: 'INBOUND',
            message_type: messageType.toUpperCase(),
            sender_phone: senderPhone,
            recipient_phone: waMetadata?.display_phone_number || null,
            text_body: textBody,
            media_mime_type:
              mediaObj && typeof mediaObj === 'object' ? mediaObj.mime_type || null : null,
            media_caption: mediaCaption,
            status: 'RECEIVED',
            status_at: statusAt || now,
            payload: inbound,
            meta: {
              profile_name: profileName,
              metadata: waMetadata || {},
            },
            updated_at: now,
          },
          {
            onConflict: 'provider_message_id',
          }
        );
        inboundCount += 1;
      }

      const statuses: WhatsAppStatus[] = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
      for (const statusItem of statuses) {
        const providerMessageId = String(statusItem?.id || '').trim();
        if (!providerMessageId) {
          skippedCount += 1;
          continue;
        }

        const mappedStatus = mapStatus(statusItem?.status);
        const statusAt = parseIsoTimestamp(statusItem?.timestamp);
        const errorMessage = statusItem?.errors?.[0]?.details || statusItem?.errors?.[0]?.title || null;

        await db.from('whatsapp_messages').upsert(
          {
            provider_message_id: providerMessageId,
            direction: 'STATUS',
            message_type: 'STATUS',
            status: mappedStatus,
            status_at: statusAt || now,
            error_message: mappedStatus === 'FAILED' ? errorMessage : null,
            payload: statusItem,
            meta: {
              status_raw: statusItem?.status || null,
            },
            updated_at: now,
          },
          {
            onConflict: 'provider_message_id',
          }
        );

        // Idempotency check: if status already matches and no new timestamps, skip update.
        const { data: existingLogRaw, error: existingError } = await db
          .from('invoice_sharing_logs')
          .select('id, sharing_status, delivered_at, viewed_at')
          .eq('provider_message_id', providerMessageId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const existingLog: any = existingLogRaw;

        if (existingError) {
          // Column may not exist before migration; keep webhook endpoint non-fatal.
          skippedCount += 1;
          continue;
        }

        if (!existingLog) {
          // Keep unmatched payload for debugging/tracing.
          await db.from('notification_logs').insert({
            recipient: providerMessageId,
            type: 'WHATSAPP_WEBHOOK',
            message: JSON.stringify({
              status: statusItem?.status,
              timestamp: statusItem?.timestamp,
              errors: statusItem?.errors || [],
            }),
            status: 'RECEIVED',
            sent_at: new Date().toISOString(),
          });
          skippedCount += 1;
          continue;
        }

        const nextUpdate: Record<string, unknown> = {
          sharing_status: mappedStatus,
          error_message: mappedStatus === 'FAILED' ? errorMessage || 'Message delivery failed' : null,
          webhook_payload: statusItem,
        };

        if (mappedStatus === 'DELIVERED' && statusAt && !existingLog.delivered_at) {
          nextUpdate.delivered_at = statusAt;
        }
        if (mappedStatus === 'VIEWED' && statusAt && !existingLog.viewed_at) {
          nextUpdate.viewed_at = statusAt;
        }

        const sameStatus = existingLog.sharing_status === mappedStatus;
        const noFreshTimestamp =
          (mappedStatus !== 'DELIVERED' || existingLog.delivered_at || !statusAt) &&
          (mappedStatus !== 'VIEWED' || existingLog.viewed_at || !statusAt);
        if (sameStatus && noFreshTimestamp) {
          skippedCount += 1;
          continue;
        }

        await db
          .from('invoice_sharing_logs')
          .update(nextUpdate)
          .eq('id', existingLog.id);
        updatedCount += 1;
      }
    }
  }

  if (webhookEvent?.id) {
    await db
      .from('whatsapp_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        process_status: 'PROCESSED',
        process_note: `inbound:${inboundCount}, status_updated:${updatedCount}, skipped:${skippedCount}`,
      })
      .eq('id', webhookEvent.id);
  }

  return NextResponse.json({
    success: true,
    inbound: inboundCount,
    updated: updatedCount,
    skipped: skippedCount,
  });
}
