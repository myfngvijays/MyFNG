import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage } from '@/lib/services/whatsappService';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

export const GOOGLE_ADS_FUNDS_ALERT_TEMPLATE = {
  template_name: 'google_ads_funds_alert',
  display_name: 'Google Ads Funds Alert',
  language_code: 'en',
  category: 'UTILITY',
  body_text:
    'MyFNG Google Ads Funds Alert\n\nTime: {{1}}\nStatus: {{2}}\n\nRemaining balance: INR {{3}}\nAlert limit: INR {{4}}\n\n{{5}}\n\nThis is an automated billing notification for MyFNG administrators.',
  variable_keys: ['timestamp', 'status', 'remaining_inr', 'threshold_inr', 'details'],
  example_values: [
    '19/09/2026 4:20 PM',
    'GOOGLE ADS FUNDS LOW',
    '850',
    '1000',
    'Daily budget INR 5000. Top up in Google Ads Billing and payments.',
  ],
} as const;

export type GoogleAdsFundsAlertTemplateStatus = {
  templateName: string;
  exists: boolean;
  isApproved: boolean;
  metaStatus: string | null;
  templateId: string | null;
  canSendTemplate: boolean;
};

function cleanParam(value: string) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 200);
}

async function verifyTemplateOnMeta(templateName: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WhatsApp API credentials are not configured');
  }

  const url = `${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,status,language,category&limit=50&name=${encodeURIComponent(
    templateName,
  )}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(payload?.error?.error_user_msg || payload?.error?.message || '').trim() ||
      'Meta verification call failed';
    throw new Error(msg);
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  return (
    data.find((row: any) => String(row?.name || '').trim().toLowerCase() === templateName.toLowerCase()) ||
    null
  );
}

export async function getGoogleAdsFundsAlertTemplateStatus(): Promise<GoogleAdsFundsAlertTemplateStatus> {
  const templateName = GOOGLE_ADS_FUNDS_ALERT_TEMPLATE.template_name;
  const base: GoogleAdsFundsAlertTemplateStatus = {
    templateName,
    exists: false,
    isApproved: false,
    metaStatus: null,
    templateId: null,
    canSendTemplate: false,
  };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('whatsapp_templates')
      .select('id, template_name, is_active, meta')
      .eq('template_name', templateName)
      .maybeSingle();

    if (data) {
      const metaStatus = String((data as any)?.meta?.status || '').toUpperCase() || null;
      base.exists = true;
      base.metaStatus = metaStatus;
      base.templateId = String((data as any)?.meta?.template_id || '') || null;
      base.isApproved = Boolean((data as any)?.is_active) || metaStatus === 'APPROVED';
      base.canSendTemplate = base.isApproved;
      return base;
    }
  }

  try {
    const verified = await verifyTemplateOnMeta(templateName);
    if (verified) {
      const metaStatus = String(verified?.status || '').toUpperCase();
      base.exists = true;
      base.metaStatus = metaStatus;
      base.templateId = String(verified?.id || '') || null;
      base.isApproved = metaStatus === 'APPROVED';
      base.canSendTemplate = base.isApproved;
    }
  } catch {
    // UI can still offer create/sync
  }

  return base;
}

export async function createGoogleAdsFundsAlertTemplate(actorId?: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WhatsApp API credentials are not configured');
  }

  const template = GOOGLE_ADS_FUNDS_ALERT_TEMPLATE;
  const existing = await verifyTemplateOnMeta(template.template_name).catch(() => null);
  if (existing) {
    return syncGoogleAdsFundsAlertTemplate(actorId);
  }

  const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: template.template_name,
      language: template.language_code,
      category: template.category,
      components: [
        {
          type: 'BODY',
          text: template.body_text,
          example: {
            body_text: [template.example_values],
          },
        },
      ],
    }),
    cache: 'no-store',
  });

  const metaResult = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(metaResult?.error?.error_user_msg || metaResult?.error?.message || '').trim() ||
      'Failed to create template on Meta';
    throw new Error(msg);
  }

  return syncGoogleAdsFundsAlertTemplate(actorId, metaResult);
}

export async function syncGoogleAdsFundsAlertTemplate(
  actorId?: string,
  createResponse?: Record<string, unknown>,
) {
  const template = GOOGLE_ADS_FUNDS_ALERT_TEMPLATE;
  const verified = await verifyTemplateOnMeta(template.template_name);
  if (!verified) {
    throw new Error('Template not found on Meta yet. If you just created it, wait a minute and refresh status.');
  }

  const metaStatus = String(verified?.status || 'PENDING').toUpperCase();
  const row = {
    template_name: template.template_name,
    display_name: template.display_name,
    language_code: template.language_code,
    category: template.category,
    body_text: template.body_text,
    variable_keys: [...template.variable_keys],
    example_values: [...template.example_values],
    is_active: metaStatus === 'APPROVED',
    meta: {
      source: 'google_ads_funds_alert',
      status: metaStatus,
      template_id: verified?.id || null,
      category: verified?.category || template.category,
      language: verified?.language || template.language_code,
      synced_at: new Date().toISOString(),
      raw: {
        create_response: createResponse || null,
        verify_response: verified,
      },
    },
    updated_at: new Date().toISOString(),
    ...(actorId ? { created_by: actorId } : {}),
  };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not available');
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_templates')
    .upsert(row, { onConflict: 'template_name' })
    .select('id, template_name, is_active, meta')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save template locally');
  }

  return {
    template: data,
    metaStatus,
    isApproved: metaStatus === 'APPROVED',
    message:
      metaStatus === 'APPROVED'
        ? 'Google Ads funds alert template is approved and ready for 24/7 alerts.'
        : 'Template submitted to Meta. Refresh status after Meta approves it (usually a few minutes).',
  };
}

export function buildGoogleAdsFundsTemplateParams(input: {
  timestamp: string;
  status: string;
  remainingInr: string;
  thresholdInr: string;
  details: string;
}): string[] {
  return [
    cleanParam(input.timestamp),
    cleanParam(input.status),
    cleanParam(input.remainingInr),
    cleanParam(input.thresholdInr),
    cleanParam(input.details),
  ];
}

export async function sendGoogleAdsFundsAlertTemplateMessage(
  phoneNumber: string,
  params: string[],
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const templateStatus = await getGoogleAdsFundsAlertTemplateStatus();
  if (!templateStatus.canSendTemplate) {
    return {
      success: false,
      error: 'google_ads_funds_alert template is not approved on Meta yet',
    };
  }

  const result = await sendTemplateMessage({
    phoneNumber,
    templateName: GOOGLE_ADS_FUNDS_ALERT_TEMPLATE.template_name,
    templateParams: params,
    languageCode: GOOGLE_ADS_FUNDS_ALERT_TEMPLATE.language_code,
  });

  return {
    success: result.success,
    error: result.error,
    messageId: result.messageId,
  };
}
