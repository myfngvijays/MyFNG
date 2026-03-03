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
  'CUSTOMER_SERVICE_EXECUTIVE',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'BILLING_SPECIALIST',
];

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

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
      __file: fileEntry instanceof File ? fileEntry : null,
    };
    return body;
  }
  const json = (await request.json()) as ParsedSendBody;
  return json || {};
}

async function uploadMediaToWhatsApp(file: File): Promise<{ mediaId: string; mimeType: string }> {
  if (!WHATSAPP_PHONE_NUMBER_ID) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured');
  if (!WHATSAPP_ACCESS_TOKEN) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');

  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('file', file, file.name || `upload-${Date.now()}`);

  const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = String(payload?.error?.message || payload?.error?.error_user_msg || 'Media upload failed');
    throw new Error(msg);
  }
  const mediaId = String(payload?.id || '').trim();
  if (!mediaId) throw new Error('Media upload did not return a media ID');
  return { mediaId, mimeType: file.type || 'application/octet-stream' };
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

    const recipientPhone = String(body?.recipient_phone || lead?.customer_phone || '').trim();
    if (!recipientPhone) {
      return NextResponse.json({ error: 'Recipient phone is required' }, { status: 400 });
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
      if (!mediaId && uploadFile) {
        const uploaded = await uploadMediaToWhatsApp(uploadFile);
        mediaId = uploaded.mediaId;
        mediaMimeTypeForLog = uploaded.mimeType || null;
      }

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

      const mediaUrlForSend = mediaUrl || (mediaId ? `/api/whatsapp/media/${encodeURIComponent(mediaId)}` : '');
      messageForLog = caption || `[${mediaType}] ${mediaUrlForSend || mediaId}`;
      requestPayload = {
        message_type: 'media',
        media_type: mediaType,
        media_url: mediaUrl || null,
        media_id: mediaId || null,
        media_mime_type: mediaMimeTypeForLog,
        caption: caption || null,
        filename: filename || null,
      };
      result = await sendMediaMessage({
        phoneNumber: recipientPhone,
        mediaType: mediaType as 'image' | 'document' | 'video' | 'audio',
        mediaUrl: mediaUrl || undefined,
        mediaId: mediaId || undefined,
        caption,
        filename,
      });
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
      if (!templateName) {
        return NextResponse.json({ error: 'template_name is required for template type' }, { status: 400 });
      }
      messageForLog = `template:${templateName}`;
      requestPayload = {
        message_type: 'template',
        template_name: templateName,
        language: languageCode,
        template_params: templateParams,
      };
      result = await sendTemplateMessage({
        phoneNumber: recipientPhone,
        templateName,
        templateParams,
        languageCode,
      });
    }

    const now = new Date().toISOString();
    const templateNameForLog = messageType === 'template' ? String(body?.template_name || '').trim() : null;
    const mediaUrlForLog =
      messageType === 'media'
        ? String(body?.media_url || '').trim() ||
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
        media_url: mediaUrlForLog,
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

    // Full WhatsApp archive row (outbound). Use plain insert so logging does not depend on unique index presence.
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
      text_body: messageType === 'text' ? messageForLog : null,
      media_url: mediaUrlForLog,
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
      },
      created_by: userProfile.id,
      updated_at: now,
    };

    const { error: archiveError } = await db.from('whatsapp_messages').insert(archivePayload);
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

    return NextResponse.json({
      success: true,
      lead_id: leadId || null,
      lead_number: lead?.lead_number || null,
      message_type: messageType,
      message_id: result.messageId,
      recipient_phone: recipientPhone,
    });
  } catch (error: any) {
    console.error('Error in WhatsApp send API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
