import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage, sendTextMessage } from '@/lib/services/whatsappService';

type ShiftReportInput = {
  startLabel: string;
  endLabel: string;
  rows: Array<{ name: string; leads: number }>;
  unassigned: number;
  totalAssigned: number;
  textMessage: string;
};

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

/**
 * Meta UTILITY template for daily telecaller lead shift report.
 * Variable {{2}} must stay single-line (Meta rejects newlines in params).
 */
export const TELECALLER_LEADS_SHIFT_TEMPLATE = {
  template_name: 'telecaller_leads_shift_report',
  display_name: 'Telecaller Leads Shift Report',
  language_code: 'en',
  category: 'UTILITY',
  body_text: [
    'MyFNG telecaller lead report',
    '',
    'Shift window: {{1}}',
    'Assigned lead counts: {{2}}',
    '',
    'This is an automated account notification for MyFNG administrators.',
  ].join('\n'),
  variable_keys: ['shift_window', 'lead_counts'],
  example_values: [
    '19 Aug 7:00 pm to 20 Aug 7:00 pm IST',
    'Vijay Tele - 14 | Rahul - 8 | Unassigned - 2',
  ],
} as const;

export type TelecallerLeadsShiftTemplateStatus = {
  templateName: string;
  exists: boolean;
  isApproved: boolean;
  metaStatus: string | null;
  metaCategory: string | null;
  templateId: string | null;
  canSendTemplate: boolean;
};

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
    data.find(
      (row: any) => String(row?.name || '').trim().toLowerCase() === templateName.toLowerCase(),
    ) || null
  );
}

export async function getTelecallerLeadsShiftTemplateStatus(): Promise<TelecallerLeadsShiftTemplateStatus> {
  const templateName = TELECALLER_LEADS_SHIFT_TEMPLATE.template_name;
  const base: TelecallerLeadsShiftTemplateStatus = {
    templateName,
    exists: false,
    isApproved: false,
    metaStatus: null,
    metaCategory: null,
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

    if (data?.id) {
      base.exists = true;
      base.templateId = String(data.id);
      const meta = data.meta && typeof data.meta === 'object' ? (data.meta as Record<string, unknown>) : {};
      base.metaStatus = String(meta.status || '').toUpperCase() || null;
      base.metaCategory = String(meta.category || '').toUpperCase() || null;
      base.isApproved = base.metaStatus === 'APPROVED' || Boolean(data.is_active);
      base.canSendTemplate = base.isApproved;
    }
  }

  try {
    const verified = await verifyTemplateOnMeta(templateName);
    if (verified) {
      base.exists = true;
      base.metaStatus = String(verified.status || '').toUpperCase() || null;
      base.metaCategory = String(verified.category || '').toUpperCase() || null;
      base.templateId = verified.id ? String(verified.id) : base.templateId;
      base.isApproved = base.metaStatus === 'APPROVED';
      base.canSendTemplate = base.isApproved;
    }
  } catch {
    /* ignore Meta lookup errors */
  }

  return base;
}

export async function syncTelecallerLeadsShiftTemplate(
  actorId?: string,
  createResponse?: Record<string, unknown>,
) {
  const template = TELECALLER_LEADS_SHIFT_TEMPLATE;
  const verified = await verifyTemplateOnMeta(template.template_name);
  if (!verified) {
    throw new Error(
      'Template not found on Meta yet. If you just created it, wait a minute and refresh status.',
    );
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
      source: 'telecaller_leads_shift_summary',
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
        ? 'Telecaller leads shift template is approved and ready for 24/7 alerts.'
        : 'Template submitted to Meta. Refresh status after Meta approves it (usually a few minutes).',
  };
}

export async function createTelecallerLeadsShiftTemplate(actorId?: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WhatsApp API credentials are not configured');
  }

  const template = TELECALLER_LEADS_SHIFT_TEMPLATE;
  const existing = await verifyTemplateOnMeta(template.template_name).catch(() => null);
  if (existing) {
    return syncTelecallerLeadsShiftTemplate(actorId);
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
      allow_category_change: false,
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

  return syncTelecallerLeadsShiftTemplate(actorId, metaResult);
}

/** Meta forbids newlines inside template variables — keep one line. */
export function buildTelecallerLeadsShiftTemplateParams(summary: ShiftReportInput): string[] {
  const shiftWindow = `${summary.startLabel} to ${summary.endLabel} IST`.replace(/\n/g, ' ').slice(0, 200);
  const parts = summary.rows.map((r) => `${r.name} - ${r.leads}`);
  if (summary.unassigned > 0) parts.push(`Unassigned - ${summary.unassigned}`);
  let leadCounts = parts.join(' | ').replace(/\n/g, ' ').trim() || 'No leads';
  if (leadCounts.length > 900) {
    leadCounts = `${leadCounts.slice(0, 890)}…`;
  }
  return [shiftWindow, leadCounts];
}

export async function sendTelecallerLeadsShiftReportMessage(
  phoneNumber: string,
  summary: ShiftReportInput,
): Promise<{ success: boolean; error?: string; messageId?: string; via: 'template' | 'text' }> {
  const params = buildTelecallerLeadsShiftTemplateParams(summary);
  const status = await getTelecallerLeadsShiftTemplateStatus();

  if (status.canSendTemplate) {
    const result = await sendTemplateMessage({
      phoneNumber,
      templateName: TELECALLER_LEADS_SHIFT_TEMPLATE.template_name,
      templateParams: params,
      languageCode: TELECALLER_LEADS_SHIFT_TEMPLATE.language_code,
    });
    if (result.success) {
      return { success: true, messageId: result.messageId, via: 'template' };
    }
    // Fall through to text if template send fails
    const textResult = await sendTextMessage(phoneNumber, summary.textMessage);
    return {
      success: textResult.success,
      error: textResult.success ? undefined : textResult.error || result.error,
      messageId: textResult.messageId,
      via: 'text',
    };
  }

  const textResult = await sendTextMessage(phoneNumber, summary.textMessage);
  return {
    success: textResult.success,
    error: textResult.success
      ? undefined
      : textResult.error ||
        'Template telecaller_leads_shift_report not approved yet — text send also failed (24h window?)',
    messageId: textResult.messageId,
    via: 'text',
  };
}
