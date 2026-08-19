import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  sendMediaMessage,
  sendTemplateMessage,
  sendTextMessage,
} from '@/lib/services/whatsappService';

type MessageType = 'text' | 'media' | 'template';
type ParsedSendBody = Record<string, any> & { __file?: File | null };

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const ALLOWED_ROLE_CODES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
  'TELECALLER',
  'LEAD_MANAGER',
  'CUSTOMER_SERVICE_EXECUTIVE',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'BILLING_SPECIALIST',
];

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
}

async function resolveUserProfile(supabase: any, user: any) {
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  return byEmail || byPhone || byId;
}

function normalizeMessageType(value: unknown): MessageType | null {
  const messageType = String(value || '').trim().toLowerCase();
  if (messageType === 'text' || messageType === 'media' || messageType === 'template') {
    return messageType;
  }
  return null;
}

async function parseIncomingBody(request: NextRequest): Promise<ParsedSendBody> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const fileEntry = form.get('file');
    const body: ParsedSendBody = {
      lead_id: form.get('lead_id') ? String(form.get('lead_id')) : '',
      invoice_id: form.get('invoice_id') ? String(form.get('invoice_id')) : '',
      recipient_phone: form.get('recipient_phone') ? String(form.get('recipient_phone')) : '',
      message_type: form.get('message_type') ? String(form.get('message_type')) : '',
      media_type: form.get('media_type') ? String(form.get('media_type')) : '',
      media_url: form.get('media_url') ? String(form.get('media_url')) : '',
      media_id: form.get('media_id') ? String(form.get('media_id')) : '',
      caption: form.get('caption') ? String(form.get('caption')) : '',
      filename: form.get('filename') ? String(form.get('filename')) : '',
      text: form.get('text') ? String(form.get('text')) : '',
      template_name: form.get('template_name') ? String(form.get('template_name')) : '',
      language: form.get('language') ? String(form.get('language')) : '',
      template_params: form.get('template_params') ? String(form.get('template_params')) : '',
      button_url_params: form.get('button_url_params') ? String(form.get('button_url_params')) : '',
      __file: fileEntry instanceof File ? fileEntry : null,
    };
    return body;
  }
  const json = (await request.json()) as ParsedSendBody;
  return json || {};
}

async function uploadMediaToSupabase(file: File): Promise<{ publicUrl: string; mimeType: string }> {
  const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const mimeType = file.type || 'application/octet-stream';
  const ext = (file.name || '').split('.').pop() || 'bin';
  const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bucket = 'whatsapp-media';

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(filePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) throw new Error('Could not generate public URL for uploaded media');

  console.log('[WA Media] Uploaded to storage:', { filePath, mimeType, size: file.size, publicUrl });
  return { publicUrl, mimeType };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await resolveUserProfile(db, user);
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = userProfile?.roles?.role_code;
    if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions', role: roleCode },
        { status: 403 }
      );
    }

    const body = await parseIncomingBody(request);
    const leadId = body?.lead_id ? String(body.lead_id).trim() : '';
    const invoiceId = body?.invoice_id ? String(body.invoice_id).trim() : null;
    const messageType = normalizeMessageType(body?.message_type);

    if (leadId && !isUuid(leadId)) {
      return NextResponse.json({ error: 'lead_id must be a valid UUID when provided' }, { status: 400 });
    }
    if (invoiceId && !isUuid(invoiceId)) {
      return NextResponse.json({ error: 'invoice_id must be a valid UUID' }, { status: 400 });
    }
    if (!messageType) {
      return NextResponse.json(
        { error: 'message_type must be one of: text, media, template' },
        { status: 400 }
      );
    }

    let lead: any = null;
    if (leadId) {
      const { data: leadRaw, error: leadError } = await db
        .from('service_leads')
        .select('id, lead_number, customer_name, customer_phone, assigned_telecaller_id')
        .eq('id', leadId)
        .single();
      lead = leadRaw;
      if (leadError || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
    }

    if (roleCode === 'TELECALLER' && lead?.assigned_telecaller_id && lead.assigned_telecaller_id !== userProfile.id) {
      return NextResponse.json(
        { error: 'Forbidden: Lead is not assigned to this telecaller' },
        { status: 403 }
      );
    }

    const recipientPhoneRaw = String(body?.recipient_phone || lead?.customer_phone || '').trim();
    const recipientPhone = normalizePhone(recipientPhoneRaw);
    if (!recipientPhone) {
      return NextResponse.json({ error: 'Recipient phone is required' }, { status: 400 });
    }

    // Skip WhatsApp DND / opt-out numbers
    try {
      const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
      const { supabaseAdmin } = getSupabaseAdmin();
      const last10 = recipientPhone.slice(-10);
      if (supabaseAdmin && last10.length === 10) {
        const { data: dnd } = await supabaseAdmin
          .from('whatsapp_dnd_numbers')
          .select('id')
          .eq('phone_last10', last10)
          .maybeSingle();
        if (dnd) {
          return NextResponse.json(
            { error: 'This number is on WhatsApp DND / opt-out list', dnd: true },
            { status: 403 },
          );
        }
      }
    } catch {
      /* table may not exist yet — ignore */
    }

    let result;
    let messageForLog = '';
    let requestPayload: Record<string, unknown> = {};
    let mediaMimeTypeForLog: string | null = null;

    if (messageType === 'text') {
      const text = String(body?.text || '').trim();
      if (!text) return NextResponse.json({ error: 'text is required for text message type' }, { status: 400 });
      messageForLog = text;
      requestPayload = {
        message_type: 'text',
        text,
      };
      result = await sendTextMessage(recipientPhone, text);
    } else if (messageType === 'media') {
      const mediaType = String(body?.media_type || '').trim().toLowerCase();
      const mediaUrl = String(body?.media_url || '').trim();
      let mediaId = String(body?.media_id || '').trim();
      const uploadFile = body?.__file instanceof File ? body.__file : null;
      const caption = body?.caption ? String(body.caption) : undefined;
      const filename = body?.filename ? String(body.filename) : undefined;
      const requestedMime = String(body?.media_mime_type || '').trim();
      if (mediaType !== 'image' && mediaType !== 'document' && mediaType !== 'video' && mediaType !== 'audio') {
        return NextResponse.json(
          { error: 'media_type must be one of: image, document, video, audio' },
          { status: 400 }
        );
      }
      if (!mediaUrl && !mediaId && !uploadFile) {
        return NextResponse.json(
          { error: 'Provide media_url, media_id, or upload file for media type' },
          { status: 400 }
        );
      }
      let storagePublicUrl = '';
      if (!mediaUrl && !mediaId && uploadFile) {
        const uploaded = await uploadMediaToSupabase(uploadFile);
        storagePublicUrl = uploaded.publicUrl;
        mediaMimeTypeForLog = uploaded.mimeType || null;
      }
      const effectiveMediaUrl = mediaUrl || storagePublicUrl;

      if (!mediaMimeTypeForLog) {
        mediaMimeTypeForLog =
          (uploadFile?.type && String(uploadFile.type).trim()) ||
          (requestedMime ? requestedMime : null) ||
          (mediaType === 'image'
            ? 'image/*'
            : mediaType === 'video'
            ? 'video/*'
            : mediaType === 'audio'
            ? 'audio/*'
            : 'application/octet-stream');
      }

      const mediaUrlForLog = effectiveMediaUrl || (mediaId ? `/api/whatsapp/media/${encodeURIComponent(mediaId)}` : '');
      messageForLog = caption || `[${mediaType}] ${mediaUrlForLog || mediaId}`;
      requestPayload = {
        message_type: 'media',
        media_type: mediaType,
        media_url: effectiveMediaUrl || null,
        media_id: mediaId || null,
        media_mime_type: mediaMimeTypeForLog,
        caption: caption || null,
        filename: filename || null,
      };
      const sendUrl = effectiveMediaUrl || undefined;
      const sendId = mediaId || undefined;
      if (sendUrl && !sendUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Media URL must be a publicly accessible HTTPS URL, got: ' + sendUrl.slice(0, 60) },
          { status: 400 }
        );
      }
      if (!sendUrl && !sendId) {
        return NextResponse.json(
          { error: 'No media URL or media ID available. Storage upload may have failed.' },
          { status: 500 }
        );
      }
      console.log('[WA Media Send] Sending:', { mediaType, mediaUrl: sendUrl, mediaId: sendId });
      result = await sendMediaMessage({
        phoneNumber: recipientPhone,
        mediaType: mediaType as 'image' | 'document' | 'video' | 'audio',
        mediaUrl: sendUrl,
        mediaId: sendId,
        caption,
        filename,
      });
      if (!result.success) {
        console.error('[WA Media Send] Failed:', { error: result.error, raw: result.raw });
      }
    } else {
      const templateName = String(body?.template_name || '').trim();
      const languageCode = String(body?.language || 'en').trim() || 'en';
      const templateParams = Array.isArray(body?.template_params)
        ? body.template_params.map((v: unknown) => String(v ?? ''))
        : typeof body?.template_params === 'string'
        ? body.template_params
            .split(',')
            .map((v: string) => String(v || '').trim())
            .filter(Boolean)
        : [];
      const buttonUrlParams = Array.isArray(body?.button_url_params)
        ? body.button_url_params.map((v: unknown) => String(v ?? ''))
        : typeof body?.button_url_params === 'string'
        ? body.button_url_params
            .split(',')
            .map((v: string) => String(v || '').trim())
            .filter(Boolean)
        : [];
      if (!templateName) {
        return NextResponse.json({ error: 'template_name is required for template type' }, { status: 400 });
      }
      messageForLog = `template:${templateName}`;
      requestPayload = {
        message_type: 'template',
        template_name: templateName,
        language: languageCode,
        template_params: templateParams,
        button_url_params: buttonUrlParams,
      };
      result = await sendTemplateMessage({
        phoneNumber: recipientPhone,
        templateName,
        templateParams,
        buttonUrlParams,
        languageCode,
      });
      if (!result.success) {
        console.error('[WA Template Send] Failed:', { templateName, paramsCount: templateParams.length, error: result.error, raw: result.raw });
      }
    }

    const now = new Date().toISOString();
    const templateNameForLog = messageType === 'template' ? String(body?.template_name || '').trim() : null;
    const mediaUrlForArchive =
      messageType === 'media'
        ? String(requestPayload?.media_url || '').trim() ||
          (String(requestPayload?.media_id || '').trim()
            ? `/api/whatsapp/media/${encodeURIComponent(String(requestPayload.media_id).trim())}`
            : null)
        : null;

    if (invoiceId) {
      await db.from('invoice_sharing_logs').insert({
        invoice_id: invoiceId,
        shared_by: userProfile.id,
        sharing_method: 'WHATSAPP',
        recipient_phone: recipientPhone,
        sharing_status: result.success ? 'SENT' : 'FAILED',
        provider_message_id: result.messageId || null,
        message_type: messageType.toUpperCase(),
        template_name: templateNameForLog,
        media_url: mediaUrlForArchive,
        shared_at: now,
        error_message: result.success ? null : result.error || 'Unknown WhatsApp error',
      });
    } else {
      await db.from('notification_logs').insert({
        recipient: recipientPhone,
        type: 'WHATSAPP',
        message: messageForLog,
        status: result.success ? 'SENT' : 'FAILED',
        sent_at: now,
      });
    }

    // Full WhatsApp archive row (outbound). Prefer admin client so RLS never drops the row.
    const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
    const { supabaseAdmin } = getSupabaseAdmin();
    const archiveDb: any = supabaseAdmin || db;

    const templateParamsForArchive =
      messageType === 'template' && Array.isArray(requestPayload?.template_params)
        ? (requestPayload.template_params as unknown[]).map((v) => String(v ?? ''))
        : [];
    const templateBodyPreview =
      messageType === 'template'
        ? (() => {
            const name = String(templateNameForLog || '');
            const paramsHint = templateParamsForArchive.filter(Boolean).join(', ');
            return paramsHint ? `Template: ${name} (${paramsHint})` : `Template: ${name}`;
          })()
        : null;

    const archivePayload = {
      provider_message_id: result.messageId || null,
      direction: 'OUTBOUND',
      message_type: messageType.toUpperCase(),
      lead_id: leadId || null,
      invoice_id: invoiceId,
      sender_phone: null,
      recipient_phone: recipientPhone,
      template_name: templateNameForLog,
      template_language: messageType === 'template' ? String(body?.language || 'en') : null,
      text_body: messageType === 'text' ? messageForLog : templateBodyPreview,
      media_url: mediaUrlForArchive,
      media_mime_type: messageType === 'media' ? mediaMimeTypeForLog : null,
      media_caption: messageType === 'media' ? String(body?.caption || '') || null : null,
      status: result.success ? 'SENT' : 'FAILED',
      status_at: now,
      error_message: result.success ? null : result.error || 'Unknown WhatsApp error',
      payload: {
        request: requestPayload,
        response: result.raw || null,
      },
      meta: {
        role_code: roleCode,
        actor_id: userProfile.id,
        actor_name: userProfile.full_name || null,
        template_params: templateParamsForArchive,
      },
      created_by: userProfile.id,
      updated_at: now,
    };

    const { data: archivedRow, error: archiveError } = await archiveDb
      .from('whatsapp_messages')
      .insert(archivePayload)
      .select(
        'id, provider_message_id, direction, message_type, sender_phone, recipient_phone, template_name, text_body, media_url, media_mime_type, media_caption, payload, meta, status, error_message, status_at, created_at',
      )
      .maybeSingle();
    if (archiveError) {
      console.error('Failed to archive outbound WhatsApp message:', archiveError);
      return NextResponse.json(
        {
          success: false,
          error: `WhatsApp API call succeeded but message archive failed: ${archiveError.message || 'unknown db error'}`,
          lead_id: leadId || null,
          message_type: messageType,
          message_id: result.messageId || null,
        },
        { status: 500 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'WhatsApp message send failed',
          lead_id: leadId || null,
          message_type: messageType,
        },
        { status: 502 }
      );
    }

    // Auto-map chat to message initiator.
    // Keep this best-effort so message send success is never blocked by assignment issues.
    try {
      const normalizedPhone = recipientPhone;
      if (normalizedPhone) {
        const { data: existingRow } = await archiveDb
          .from('whatsapp_chat_assignments')
          .select('assigned_to_ids, assigned_note')
          .eq('phone', normalizedPhone)
          .maybeSingle();

        const existingIds = Array.isArray(existingRow?.assigned_to_ids)
          ? existingRow.assigned_to_ids.map((id: any) => String(id || '').trim()).filter(Boolean)
          : [];

        // Ensure initiator is always present; cap at 2 assignees.
        const mergedIds = Array.from(new Set([...existingIds.filter((id: string) => id !== userProfile.id), userProfile.id]));
        const nextAssignedToIds = mergedIds.slice(-2);
        const nowIso = new Date().toISOString();

        await archiveDb.from('whatsapp_chat_assignments').upsert(
          {
            phone: normalizedPhone,
            assigned_to_ids: nextAssignedToIds,
            assigned_by: userProfile.id,
            assigned_note: existingRow?.assigned_note || null,
            assigned_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'phone' }
        );
      }
    } catch (assignmentError) {
      console.warn('WhatsApp chat auto-assignment failed:', assignmentError);
    }

    return NextResponse.json({
      success: true,
      lead_id: leadId || null,
      lead_number: lead?.lead_number || null,
      message_type: messageType,
      message_id: result.messageId,
      recipient_phone: recipientPhone,
      message: archivedRow || null,
    });
  } catch (error: any) {
    console.error('Error in WhatsApp send API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
