import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getResolvedWhatsAppAgentsCredentials,
  type ResolvedWhatsAppAgentsCredentials,
} from '@/lib/whatsappAgents/shared/envConfigStore';

export const OTP_TEMPLATE_NAME = 'otp';
export const OTP_TEMPLATE_BODY =
  '*{{1}}* is your verification code. For your security, do not share this code.';

type MetaTemplateRow = {
  id?: string;
  name?: string;
  status?: string;
  language?: string;
  category?: string;
  components?: unknown[];
};

function assertWhatsAppCreds(creds: ResolvedWhatsAppAgentsCredentials) {
  if (!creds.whatsapp_access_token?.trim()) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  }
  if (!creds.whatsapp_business_account_id?.trim()) {
    throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
  }
}

export async function fetchOtpTemplateOnMeta(
  creds: ResolvedWhatsAppAgentsCredentials,
  templateName = OTP_TEMPLATE_NAME,
): Promise<MetaTemplateRow | null> {
  assertWhatsAppCreds(creds);
  const url = `${creds.whatsapp_api_url}/${creds.whatsapp_business_account_id}/message_templates?fields=id,name,status,language,category,components&limit=50&name=${encodeURIComponent(
    templateName,
  )}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${creds.whatsapp_access_token}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(payload?.error?.error_user_msg || payload?.error?.message || '').trim() ||
      'Meta OTP template lookup failed';
    throw new Error(msg);
  }
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return (
    rows.find((row: MetaTemplateRow) => String(row?.name || '').trim().toLowerCase() === templateName) || null
  );
}

async function createAuthenticationOtpTemplateOnMeta(
  creds: ResolvedWhatsAppAgentsCredentials,
  languageCode: string,
  templateName = OTP_TEMPLATE_NAME,
) {
  assertWhatsAppCreds(creds);
  const response = await fetch(
    `${creds.whatsapp_api_url}/${creds.whatsapp_business_account_id}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.whatsapp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: templateName,
        language: languageCode,
        category: 'AUTHENTICATION',
        message_send_ttl_seconds: 600,
        components: [
          { type: 'BODY', add_security_recommendation: true },
          { type: 'FOOTER', code_expiration_minutes: 10 },
          {
            type: 'BUTTONS',
            buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy code' }],
          },
        ],
      }),
      cache: 'no-store',
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(payload?.error?.error_user_msg || payload?.error?.message || '').trim() ||
      'Failed to create AUTHENTICATION otp template on Meta';
    throw new Error(msg);
  }
  return payload;
}

function isAlreadyExistsError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already exists') ||
    normalized.includes('already english content') ||
    normalized.includes('already content for this template')
  );
}

export async function ensureOtpTemplateOnCurrentWaba(): Promise<{
  success: boolean;
  action: 'linked' | 'created' | 'already_approved';
  metaStatus: string;
  wabaId: string;
  message: string;
  template?: MetaTemplateRow | null;
}> {
  const creds = await getResolvedWhatsAppAgentsCredentials(true);
  assertWhatsAppCreds(creds);

  let verified = await fetchOtpTemplateOnMeta(creds);
  if (verified) {
    const metaStatus = String(verified.status || 'PENDING').toUpperCase();
    await upsertLocalOtpTemplate(verified, metaStatus === 'APPROVED' ? 'meta_otp_linked' : 'meta_otp_pending');
    return {
      success: true,
      action: metaStatus === 'APPROVED' ? 'already_approved' : 'linked',
      metaStatus,
      wabaId: creds.whatsapp_business_account_id,
      message:
        metaStatus === 'APPROVED'
          ? 'OTP template is approved on this WABA.'
          : `OTP template found on Meta with status ${metaStatus}. Wait for approval, then retry OTP.`,
      template: verified,
    };
  }

  const languages = ['en', 'en_US'];
  let lastError = 'Failed to create OTP template on Meta';
  for (const languageCode of languages) {
    try {
      await createAuthenticationOtpTemplateOnMeta(creds, languageCode);
      verified = await fetchOtpTemplateOnMeta(creds);
      if (verified) break;
    } catch (error: unknown) {
      lastError = String((error as { message?: string })?.message || lastError);
      if (isAlreadyExistsError(lastError)) {
        verified = await fetchOtpTemplateOnMeta(creds);
        if (verified) break;
      }
    }
  }

  if (!verified) {
    throw new Error(lastError);
  }

  const metaStatus = String(verified.status || 'PENDING').toUpperCase();
  await upsertLocalOtpTemplate(verified, 'meta_otp_create');

  return {
    success: true,
    action: 'created',
    metaStatus,
    wabaId: creds.whatsapp_business_account_id,
    message:
      metaStatus === 'APPROVED'
        ? 'OTP template created and approved on Meta.'
        : `OTP template submitted to Meta (${metaStatus}). Booking/app OTP will work after Meta approves it.`,
    template: verified,
  };
}

async function upsertLocalOtpTemplate(verified: MetaTemplateRow, source: string) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const metaStatus = String(verified?.status || 'PENDING').toUpperCase();
  const row = {
    template_name: OTP_TEMPLATE_NAME,
    display_name: 'OTP',
    language_code: String(verified?.language || 'en').trim() || 'en',
    category: 'AUTHENTICATION',
    body_text: OTP_TEMPLATE_BODY,
    variable_keys: ['variable_1'],
    example_values: ['123456'],
    is_active: metaStatus === 'APPROVED',
    meta: {
      source,
      status: metaStatus,
      template_id: verified?.id || null,
      category: verified?.category || 'AUTHENTICATION',
      language: verified?.language || 'en',
      synced_at: new Date().toISOString(),
      raw: verified,
    },
    updated_at: new Date().toISOString(),
  };

  await supabaseAdmin.from('whatsapp_templates').upsert(row, { onConflict: 'template_name' });
}

export function isAuthenticationOtpTemplate(templateName: string, category?: string | null) {
  const name = String(templateName || '').trim().toLowerCase();
  const cat = String(category || '').trim().toUpperCase();
  return name === OTP_TEMPLATE_NAME || cat === 'AUTHENTICATION';
}
