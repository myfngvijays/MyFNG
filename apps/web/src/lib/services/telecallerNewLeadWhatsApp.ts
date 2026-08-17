import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage } from '@/lib/services/whatsappService';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

export const TELECALLER_NEW_LEAD_WHATSAPP_SETTING_KEY = 'telecaller_new_lead_whatsapp';

export const TELECALLER_NEW_LEAD_TEMPLATE = {
  template_name: 'telecaller_new_lead_alert',
  display_name: 'Telecaller New Lead Alert',
  language_code: 'en',
  category: 'UTILITY',
  body_text:
    'MyFNG Lead Alert\n\nHi {{1}},\n\nNew lead assigned to you.\n\nLead: {{2}}\nCustomer: {{3}}\nPhone: {{4}}\n\nOpen the MyFNG Telecaller app to follow up.',
  variable_keys: ['telecaller_name', 'lead_number', 'customer_name', 'customer_phone'],
  example_values: ['Priya', 'SL-10245', 'Rahul Sharma', '9876543210'],
} as const;

export type TelecallerNewLeadWhatsAppSettings = {
  enabled: boolean;
};

export type TelecallerNewLeadTemplateStatus = {
  templateName: string;
  exists: boolean;
  isApproved: boolean;
  metaStatus: string | null;
  templateId: string | null;
  canSendTemplate: boolean;
};

const DEFAULT_SETTINGS: TelecallerNewLeadWhatsAppSettings = { enabled: false };

function parseSettings(raw: unknown): TelecallerNewLeadWhatsAppSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  return { enabled: Boolean((value as { enabled?: boolean }).enabled) };
}

export async function getTelecallerNewLeadWhatsAppSettings(): Promise<TelecallerNewLeadWhatsAppSettings> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ...DEFAULT_SETTINGS };

  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', TELECALLER_NEW_LEAD_WHATSAPP_SETTING_KEY)
    .maybeSingle();

  return parseSettings(data?.setting_value);
}

export async function saveTelecallerNewLeadWhatsAppSettings(
  partial: Partial<TelecallerNewLeadWhatsAppSettings>,
): Promise<TelecallerNewLeadWhatsAppSettings> {
  const current = await getTelecallerNewLeadWhatsAppSettings();
  const next: TelecallerNewLeadWhatsAppSettings = {
    enabled: partial.enabled !== undefined ? Boolean(partial.enabled) : current.enabled,
  };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin client is not available');

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: TELECALLER_NEW_LEAD_WHATSAPP_SETTING_KEY,
      setting_value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );

  if (error) throw new Error(error.message || 'Failed to save settings');
  return next;
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
    data.find((row: { name?: string }) => String(row?.name || '').trim().toLowerCase() === templateName.toLowerCase()) ||
    null
  );
}

export async function getTelecallerNewLeadTemplateStatus(): Promise<TelecallerNewLeadTemplateStatus> {
  const templateName = TELECALLER_NEW_LEAD_TEMPLATE.template_name;
  const base: TelecallerNewLeadTemplateStatus = {
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
      const metaStatus = String((data as { meta?: { status?: string; template_id?: string } })?.meta?.status || '')
        .toUpperCase() || null;
      base.exists = true;
      base.metaStatus = metaStatus;
      base.templateId =
        String((data as { meta?: { template_id?: string } })?.meta?.template_id || '') || null;
      base.isApproved = Boolean((data as { is_active?: boolean }).is_active) || metaStatus === 'APPROVED';
      base.canSendTemplate = base.isApproved;
      return base;
    }
  }

  try {
    const verified = await verifyTemplateOnMeta(templateName);
    if (verified) {
      const metaStatus = String((verified as { status?: string })?.status || '').toUpperCase();
      base.exists = true;
      base.metaStatus = metaStatus;
      base.templateId = String((verified as { id?: string })?.id || '') || null;
      base.isApproved = metaStatus === 'APPROVED';
      base.canSendTemplate = base.isApproved;
    }
  } catch {
    // UI can still offer create/sync
  }

  return base;
}

export async function createTelecallerNewLeadTemplate(actorId?: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WhatsApp API credentials are not configured');
  }

  const template = TELECALLER_NEW_LEAD_TEMPLATE;
  const existing = await verifyTemplateOnMeta(template.template_name).catch(() => null);
  if (existing) {
    return syncTelecallerNewLeadTemplate(actorId);
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

  return syncTelecallerNewLeadTemplate(actorId, metaResult);
}

export async function syncTelecallerNewLeadTemplate(
  actorId?: string,
  createResponse?: Record<string, unknown>,
) {
  const template = TELECALLER_NEW_LEAD_TEMPLATE;
  const verified = await verifyTemplateOnMeta(template.template_name);
  if (!verified) {
    throw new Error('Template not found on Meta yet. If you just created it, wait a minute and refresh status.');
  }

  const metaStatus = String((verified as { status?: string })?.status || 'PENDING').toUpperCase();
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
      source: 'telecaller_new_lead_alert',
      status: metaStatus,
      template_id: (verified as { id?: string })?.id || null,
      category: (verified as { category?: string })?.category || template.category,
      language: (verified as { language?: string })?.language || template.language_code,
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
  if (!supabaseAdmin) throw new Error('Supabase admin client is not available');

  const { data, error } = await supabaseAdmin
    .from('whatsapp_templates')
    .upsert(row, { onConflict: 'template_name' })
    .select('id, template_name, is_active, meta')
    .single();

  if (error) throw new Error(error.message || 'Failed to save template locally');

  return {
    template: data,
    metaStatus,
    isApproved: metaStatus === 'APPROVED',
    message:
      metaStatus === 'APPROVED'
        ? 'Telecaller new-lead WhatsApp template is approved and ready.'
        : 'Template submitted to Meta. Refresh status after Meta approves it.',
  };
}

export function buildTelecallerNewLeadTemplateParams(input: {
  telecallerName: string;
  leadNumber: string;
  customerName: string;
  customerPhone: string;
}): string[] {
  return [
    String(input.telecallerName || 'Telecaller').trim() || 'Telecaller',
    String(input.leadNumber || 'Lead').trim() || 'Lead',
    String(input.customerName || 'Customer').trim() || 'Customer',
    String(input.customerPhone || '-').trim() || '-',
  ];
}

export async function sendTelecallerNewLeadTemplateMessage(
  phoneNumber: string,
  params: string[],
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const templateStatus = await getTelecallerNewLeadTemplateStatus();
  if (!templateStatus.canSendTemplate) {
    return {
      success: false,
      error: 'telecaller_new_lead_alert template is not approved on Meta yet',
    };
  }

  const result = await sendTemplateMessage({
    phoneNumber,
    templateName: TELECALLER_NEW_LEAD_TEMPLATE.template_name,
    templateParams: params,
    languageCode: TELECALLER_NEW_LEAD_TEMPLATE.language_code,
  });

  return {
    success: result.success,
    error: result.error,
    messageId: result.messageId,
  };
}

/**
 * Best-effort WhatsApp alert when a lead is assigned to a telecaller.
 * Respects admin toggle + Meta template approval. Never throws.
 */
export async function notifyTelecallerNewLeadWhatsAppSafe(params: {
  leadId?: string | null;
  leadNumber?: string | null;
  telecallerId?: string | null;
}): Promise<{ sent: boolean; skipped?: boolean; reason?: string }> {
  try {
    const settings = await getTelecallerNewLeadWhatsAppSettings();
    if (!settings.enabled) return { sent: false, skipped: true, reason: 'disabled' };

    const telecallerId = String(params.telecallerId || '').trim();
    const leadId = String(params.leadId || '').trim();
    if (!telecallerId || !leadId) return { sent: false, skipped: true, reason: 'missing_ids' };

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return { sent: false, skipped: true, reason: 'no_admin' };

    const [{ data: telecaller }, { data: lead }] = await Promise.all([
      supabaseAdmin
        .from('users_login')
        .select('id, full_name, phone')
        .eq('id', telecallerId)
        .maybeSingle(),
      supabaseAdmin
        .from('service_leads')
        .select('id, lead_number, customer_name, customer_phone')
        .eq('id', leadId)
        .maybeSingle(),
    ]);

    const phone = String(telecaller?.phone || '').trim();
    if (!phone) return { sent: false, skipped: true, reason: 'telecaller_no_phone' };

    const templateParams = buildTelecallerNewLeadTemplateParams({
      telecallerName: String(telecaller?.full_name || 'Telecaller').trim() || 'Telecaller',
      leadNumber: String(params.leadNumber || lead?.lead_number || leadId).trim(),
      customerName: String(lead?.customer_name || 'Customer').trim() || 'Customer',
      customerPhone: String(lead?.customer_phone || '-').trim() || '-',
    });

    const result = await sendTelecallerNewLeadTemplateMessage(phone, templateParams);
    if (!result.success) {
      console.warn('[notifyTelecallerNewLeadWhatsAppSafe]', result.error);
      return { sent: false, reason: result.error || 'send_failed' };
    }
    return { sent: true };
  } catch (err) {
    console.warn('[notifyTelecallerNewLeadWhatsAppSafe] failed (non-blocking):', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'error' };
  }
}
