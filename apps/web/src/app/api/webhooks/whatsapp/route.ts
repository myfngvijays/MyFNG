import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

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

type WhatsAppCallEvent = {
  id?: string;
  call_id?: string;
  conversation_id?: string;
  direction?: string;
  event?: string;
  status?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  started_at?: string;
  ended_at?: string;
  duration?: number | string;
  callback_requested?: boolean;
  error?: { message?: string; details?: string };
  session?: unknown;
  candidates?: unknown;
  recording?: unknown;
  recordings?: unknown;
};

function mapStatus(status: string | undefined): 'SENT' | 'DELIVERED' | 'VIEWED' | 'FAILED' {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'delivered') return 'DELIVERED';
  if (normalized === 'read') return 'VIEWED';
  if (normalized === 'failed' || normalized === 'undelivered') return 'FAILED';
  return 'SENT';
}

function mapCallDirection(direction: string | undefined): 'INBOUND' | 'OUTBOUND' {
  const normalized = String(direction || '').trim().toUpperCase();
  if (['INBOUND', 'USER_INITIATED', 'CUSTOMER_INITIATED'].includes(normalized)) return 'INBOUND';
  if (['OUTBOUND', 'BUSINESS_INITIATED', 'AGENT_INITIATED'].includes(normalized)) return 'OUTBOUND';
  return 'INBOUND';
}

function mapCallStatus(status: string | undefined, event: string | undefined): string {
  const normalized = String(status || '').trim().toLowerCase();
  const normalizedEvent = String(event || '').trim().toLowerCase();

  if (['terminate', 'hangup', 'ended', 'end'].includes(normalizedEvent)) return 'ENDED';
  if (['ringing', 'ring', 'incoming'].includes(normalizedEvent)) return 'RINGING';
  if (['accept', 'accepted', 'answer', 'connected'].includes(normalizedEvent)) return 'ACCEPTED';
  if (['reject', 'rejected', 'declined', 'busy'].includes(normalizedEvent)) return 'REJECTED';
  if (['missed', 'no_answer'].includes(normalizedEvent)) return 'MISSED';

  if (['initiated', 'dialing', 'calling'].includes(normalized)) return 'INITIATED';
  if (['ringing', 'ring'].includes(normalized)) return 'RINGING';
  if (['accepted', 'connected', 'in_progress', 'ongoing'].includes(normalized)) return 'ACCEPTED';
  if (['ended', 'completed', 'hangup'].includes(normalized)) return 'ENDED';
  if (['missed', 'no_answer'].includes(normalized)) return 'MISSED';
  if (['rejected', 'declined', 'busy'].includes(normalized)) return 'REJECTED';
  if (['callback_requested', 'callback'].includes(normalized)) return 'CALLBACK_REQUESTED';
  if (['failed', 'error', 'undelivered'].includes(normalized)) return 'FAILED';
  return String(status || 'INITIATED').toUpperCase();
}

function parseIsoTimestamp(unixTimestamp: string | undefined): string | null {
  const ts = Number(unixTimestamp || '');
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

function parseTimestampFlexible(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'number' || /^\d+$/.test(String(input))) {
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n > 10_000_000_000 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  const str = String(input).trim();
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizePhone(phone: unknown): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function extractCallEvents(changeValue: any): WhatsAppCallEvent[] {
  const directCalls = Array.isArray(changeValue?.calls) ? changeValue.calls : [];
  const nestedCalls = Array.isArray(changeValue?.statuses?.calls) ? changeValue.statuses.calls : [];
  const messageCalls = Array.isArray(changeValue?.messages?.calls) ? changeValue.messages.calls : [];
  return [...directCalls, ...nestedCalls, ...messageCalls].filter(Boolean);
}

function extractRecordings(call: WhatsAppCallEvent): any[] {
  const one = call?.recording;
  const many = Array.isArray(call?.recordings) ? call.recordings : [];
  const output: any[] = [];
  if (one && typeof one === 'object') output.push(one);
  many.forEach((rec) => {
    if (rec && typeof rec === 'object') output.push(rec);
  });
  return output;
}

function extractSessionCandidates(call: WhatsAppCallEvent): any[] {
  const fromCall = Array.isArray(call?.candidates) ? call.candidates : [];
  const sessionObj = call?.session && typeof call.session === 'object' ? (call.session as any) : null;
  const fromSession = Array.isArray(sessionObj?.candidates) ? sessionObj.candidates : [];
  return [...fromCall, ...fromSession].filter(Boolean);
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

  const { supabaseAdmin } = getSupabaseAdmin();
  const db: any = supabaseAdmin || (await createClient());
  const now = new Date().toISOString();
  const { data: webhookEvent, error: webhookInsertError } = await db
    .from('whatsapp_webhook_events')
    .insert({
      event_type: 'messages',
      payload: body,
      received_at: now,
      process_status: 'RECEIVED',
    })
    .select('id')
    .maybeSingle();

  if (webhookInsertError) {
    console.error('Failed to insert webhook event:', webhookInsertError);
    return NextResponse.json(
      { error: `Webhook insert failed: ${webhookInsertError.message || 'unknown db error'}` },
      { status: 500 }
    );
  }

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let updatedCount = 0;
  let invoiceUpdatedCount = 0;
  let skippedCount = 0;
  let inboundCount = 0;
  let failedCount = 0;
  let callUpdatedCount = 0;
  let recordingUpdatedCount = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const changeField = String(change?.field || '').trim().toLowerCase();
      if (changeField !== 'messages' && changeField !== 'calls') continue;

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
        const mediaId =
          mediaObj && typeof mediaObj === 'object' ? String(mediaObj.id || '').trim() : '';
        const mediaCaption =
          mediaObj && typeof mediaObj === 'object'
            ? mediaObj.caption || null
            : null;

        const inboundRow = {
          provider_message_id: providerMessageId || null,
          direction: 'INBOUND',
          message_type: messageType.toUpperCase(),
          sender_phone: senderPhone,
          recipient_phone: waMetadata?.display_phone_number || null,
          text_body: textBody,
          media_url: mediaId ? `/api/whatsapp/media/${encodeURIComponent(mediaId)}` : null,
          media_mime_type: mediaObj && typeof mediaObj === 'object' ? mediaObj.mime_type || null : null,
          media_caption: mediaCaption,
          status: 'RECEIVED',
          status_at: statusAt || now,
          payload: inbound,
          meta: {
            profile_name: profileName,
            metadata: waMetadata || {},
          },
          updated_at: now,
        };

        const { error: inboundUpsertError } = await db.from('whatsapp_messages').upsert(inboundRow, {
          onConflict: 'provider_message_id',
        });

        if (inboundUpsertError) {
          // Fallback: plain insert helps when DB lacks/changes unique conflict config.
          const { error: inboundInsertError } = await db.from('whatsapp_messages').insert(inboundRow);
          if (inboundInsertError) {
            failedCount += 1;
            console.error('Failed to store inbound WhatsApp message:', {
              providerMessageId,
              upsertError: inboundUpsertError,
              insertError: inboundInsertError,
            });
            continue;
          }
        }

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

        // Update existing outbound/inbound archive row with latest delivery status.
        const { data: existingMsgRaw } = await db
          .from('whatsapp_messages')
          .select('id, status, status_at, meta, created_at')
          .eq('provider_message_id', providerMessageId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const existingMsg: any = existingMsgRaw;
        let updatedMsg: { id?: string } | null = null;

        if (existingMsg?.id) {
          const existingMeta =
            existingMsg?.meta && typeof existingMsg.meta === 'object' ? existingMsg.meta : {};
          const existingTimestamps =
            existingMeta?.status_timestamps && typeof existingMeta.status_timestamps === 'object'
              ? existingMeta.status_timestamps
              : {};
          const nextTimestamps: Record<string, string> = { ...existingTimestamps };

          // Preserve first known "sent_at" and append downstream status timestamps.
          if (!nextTimestamps.sent_at) {
            const fallbackSentAt = existingMsg?.created_at || existingMsg?.status_at || now;
            nextTimestamps.sent_at = String(fallbackSentAt);
          }
          if (mappedStatus === 'SENT') {
            nextTimestamps.sent_at = String(statusAt || nextTimestamps.sent_at || now);
          }
          if (mappedStatus === 'DELIVERED') {
            nextTimestamps.delivered_at = String(statusAt || now);
          }
          if (mappedStatus === 'VIEWED') {
            nextTimestamps.viewed_at = String(statusAt || now);
          }
          if (mappedStatus === 'FAILED') {
            nextTimestamps.failed_at = String(statusAt || now);
          }

          const mergedMeta = {
            ...existingMeta,
            status_raw: statusItem?.status || existingMeta?.status_raw || null,
            status_timestamps: nextTimestamps,
          };

          const { data: updatedMsgRaw } = await db
            .from('whatsapp_messages')
            .update({
              status: mappedStatus,
              status_at: statusAt || now,
              error_message: mappedStatus === 'FAILED' ? errorMessage : null,
              meta: mergedMeta,
              updated_at: now,
            })
            .eq('id', existingMsg.id)
            .select('id')
            .maybeSingle();
          updatedMsg = updatedMsgRaw || null;
        }

        if (updatedMsg?.id) {
          updatedCount += 1;
        } else {
          // Keep unmatched status payload archived for tracing.
          await db.from('whatsapp_messages').insert({
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
          });
        }

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
          // Status can belong to non-invoice sends; don't treat as failure/skip.
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
        invoiceUpdatedCount += 1;
      }

      const callEvents = extractCallEvents(change?.value);
      for (const callItem of callEvents) {
        console.log('[Webhook:Call] event received:', JSON.stringify({
          id: callItem?.id || callItem?.call_id,
          event: callItem?.event,
          status: callItem?.status,
          direction: callItem?.direction,
          from: callItem?.from,
          to: callItem?.to,
          has_session: !!(callItem?.session),
          session_keys: callItem?.session ? Object.keys(callItem.session as any) : [],
          has_candidates: !!(callItem?.candidates),
        }));
        const providerCallId = String(callItem?.call_id || callItem?.id || '').trim();
        const mappedCallStatus = mapCallStatus(callItem?.status, callItem?.event);
        const startedAt =
          parseTimestampFlexible(callItem?.started_at) ||
          parseTimestampFlexible(callItem?.timestamp) ||
          null;
        const endedAt = parseTimestampFlexible(callItem?.ended_at) || null;
        const durationRaw = Number(callItem?.duration);
        const durationSeconds = Number.isFinite(durationRaw) && durationRaw >= 0 ? Math.floor(durationRaw) : null;
        const customerPhone =
          normalizePhone(callItem?.from) || normalizePhone(callItem?.to) || normalizePhone(change?.value?.from);
        if (!customerPhone) {
          skippedCount += 1;
          continue;
        }

        const errorMessage = String(
          callItem?.error?.details || callItem?.error?.message || ''
        ).trim() || null;

        const callPayload = {
          provider_call_id: providerCallId || null,
          provider_conversation_id: String(callItem?.conversation_id || '').trim() || null,
          direction: mapCallDirection(callItem?.direction),
          call_status: mappedCallStatus,
          customer_phone: customerPhone,
          started_at: startedAt,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
          callback_requested:
            Boolean(callItem?.callback_requested) || mappedCallStatus === 'CALLBACK_REQUESTED',
          recording_available: extractRecordings(callItem).length > 0,
          recording_count: extractRecordings(callItem).length,
          error_message: errorMessage,
          payload: callItem,
          meta: {
            source: 'webhook',
            field: change?.field || null,
          },
          updated_at: now,
        };

        let callLogId: string | null = null;
        if (providerCallId) {
          const { data: upserted, error: upsertError } = await db
            .from('whatsapp_call_logs')
            .upsert(callPayload, { onConflict: 'provider_call_id' })
            .select('id')
            .maybeSingle();
          if (upsertError) {
            const { data: inserted, error: insertError } = await db
              .from('whatsapp_call_logs')
              .insert(callPayload)
              .select('id')
              .maybeSingle();
            if (insertError) {
              failedCount += 1;
              continue;
            }
            callLogId = inserted?.id || null;
          } else {
            callLogId = upserted?.id || null;
          }
        } else {
          const { data: inserted, error: insertError } = await db
            .from('whatsapp_call_logs')
            .insert(callPayload)
            .select('id')
            .maybeSingle();
          if (insertError) {
            failedCount += 1;
            continue;
          }
          callLogId = inserted?.id || null;
        }
        callUpdatedCount += 1;

        const sessionObj = callItem?.session && typeof callItem.session === 'object' ? (callItem.session as any) : null;
        const providerSessionId = String(
          sessionObj?.id || sessionObj?.session_id || sessionObj?.provider_session_id || ''
        ).trim();
        const sessionSdp = String(sessionObj?.sdp || '').trim();
        const sessionSdpType = String(sessionObj?.sdp_type || '').trim().toLowerCase();
        if (callLogId && (providerSessionId || sessionSdp)) {
          const sessionState =
            mappedCallStatus === 'ACCEPTED'
              ? 'CONNECTED'
              : mappedCallStatus === 'ENDED'
              ? 'ENDED'
              : mappedCallStatus === 'FAILED'
              ? 'FAILED'
              : 'NEGOTIATING';
          const sessionPayload: Record<string, unknown> = {
            call_log_id: callLogId,
            provider_call_id: providerCallId || null,
            provider_session_id: providerSessionId || null,
            session_state: sessionState,
            payload: sessionObj || callItem,
            meta: {
              source: 'webhook',
              field: change?.field || null,
            },
            updated_at: now,
          };
          if (sessionSdp && sessionSdpType === 'offer') {
            sessionPayload.offer_sdp = sessionSdp;
            sessionPayload.offer_sdp_type = 'offer';
          }
          if (sessionSdp && (sessionSdpType === 'answer' || sessionSdpType === 'pranswer')) {
            sessionPayload.answer_sdp = sessionSdp;
            sessionPayload.answer_sdp_type = sessionSdpType;
          }

          if (providerSessionId) {
            await db.from('whatsapp_call_sessions').upsert(sessionPayload, {
              onConflict: 'provider_session_id',
            });
          } else {
            await db.from('whatsapp_call_sessions').insert(sessionPayload);
          }
        }

        const sessionCandidates = extractSessionCandidates(callItem);
        if (callLogId && sessionCandidates.length > 0) {
          let targetSessionId = '';
          if (providerSessionId) {
            const { data: existingSession } = await db
              .from('whatsapp_call_sessions')
              .select('id')
              .eq('provider_session_id', providerSessionId)
              .maybeSingle();
            targetSessionId = String(existingSession?.id || '');
          } else {
            const { data: latestSession } = await db
              .from('whatsapp_call_sessions')
              .select('id')
              .eq('call_log_id', callLogId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            targetSessionId = String(latestSession?.id || '');
          }
          if (targetSessionId) {
            for (const candidateItem of sessionCandidates) {
              const candidate = String(
                candidateItem?.candidate || candidateItem?.value || candidateItem || ''
              ).trim();
              if (!candidate) continue;
              await db.from('whatsapp_call_ice_candidates').insert({
                session_id: targetSessionId,
                direction: 'INBOUND',
                candidate,
                sdp_mid: candidateItem?.sdp_mid ? String(candidateItem.sdp_mid) : null,
                sdp_mline_index:
                  candidateItem?.sdp_mline_index != null &&
                  Number.isFinite(Number(candidateItem.sdp_mline_index))
                    ? Math.floor(Number(candidateItem.sdp_mline_index))
                    : null,
                payload: candidateItem && typeof candidateItem === 'object' ? candidateItem : {},
              });
            }
          }
        }

        const recordings = extractRecordings(callItem);
        for (const recording of recordings) {
          const providerRecordingId = String(
            recording?.id || recording?.recording_id || recording?.media_id || ''
          ).trim();
          const recordingUrl = String(recording?.url || recording?.recording_url || '').trim() || null;
          const recDurationRaw = Number(recording?.duration || recording?.duration_seconds);
          const recDuration =
            Number.isFinite(recDurationRaw) && recDurationRaw >= 0 ? Math.floor(recDurationRaw) : null;
          const recSizeRaw = Number(recording?.size || recording?.size_bytes);
          const recSize = Number.isFinite(recSizeRaw) && recSizeRaw >= 0 ? Math.floor(recSizeRaw) : null;

          const recordingPayload = {
            call_log_id: callLogId,
            provider_call_id: providerCallId || null,
            provider_recording_id: providerRecordingId || null,
            recording_url: recordingUrl,
            mime_type: String(recording?.mime_type || '').trim() || null,
            duration_seconds: recDuration,
            size_bytes: recSize,
            available_at: parseTimestampFlexible(recording?.available_at) || now,
            expires_at: parseTimestampFlexible(recording?.expires_at),
            payload: recording,
            meta: {
              source: 'webhook',
            },
            updated_at: now,
          };

          if (providerRecordingId) {
            await db
              .from('whatsapp_call_recordings')
              .upsert(recordingPayload, { onConflict: 'provider_recording_id' });
          } else {
            await db.from('whatsapp_call_recordings').insert(recordingPayload);
          }
          recordingUpdatedCount += 1;
        }
      }
    }
  }

  if (webhookEvent?.id) {
    const { error: webhookUpdateError } = await db
      .from('whatsapp_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        process_status: 'PROCESSED',
        process_note: `inbound:${inboundCount}, status_updated:${updatedCount}, invoice_updated:${invoiceUpdatedCount}, calls_updated:${callUpdatedCount}, recordings_updated:${recordingUpdatedCount}, skipped:${skippedCount}, failed:${failedCount}`,
      })
      .eq('id', webhookEvent.id);
    if (webhookUpdateError) {
      console.error('Failed to update webhook event:', webhookUpdateError);
    }
  }

  return NextResponse.json({
    success: true,
    inbound: inboundCount,
    updated: updatedCount,
    calls_updated: callUpdatedCount,
    recordings_updated: recordingUpdatedCount,
    skipped: skippedCount,
    failed: failedCount,
  });
}
