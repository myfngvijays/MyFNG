import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage, sendTextMessage } from '@/lib/services/whatsappService';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

export const SYSTEM_HEALTH_ALERT_TEMPLATE = {
  template_name: 'system_health_alert',
  display_name: 'System Health Alert',
  language_code: 'en',
  category: 'UTILITY',
  body_text:
    'MyFNG System Health Report\n\nTime: {{1}}\nStatus: {{2}}\n\n{{3}}\n\nHealthy: {{4}}/{{5}}\nNext check in 3 hours.',
  variable_keys: ['timestamp', 'status', 'details', 'healthy_count', 'total_count'],
  example_values: [
    '13/07/2026 1:25 AM',
    'ALL SYSTEMS OPERATIONAL',
    'All 10 services are healthy.',
    '10',
    '10',
  ],
} as const;

export type HealthAlertSummary = {
  timestamp: string;
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  downServices: Array<{ name: string; message?: string }>;
  degradedServices: Array<{ name: string }>;
};

export type HealthAlertTemplateStatus = {
  templateName: string;
  exists: boolean;
  isApproved: boolean;
  metaStatus: string | null;
  templateId: string | null;
  canSendTemplate: boolean;
};

function truncate(value: string, max = 900) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export function buildHealthAlertContent(summary: HealthAlertSummary) {
  const { timestamp, total, healthy, downServices, degradedServices } = summary;

  let statusLabel = 'ALL SYSTEMS OPERATIONAL';
  let details = `All ${total} services are healthy.`;

  if (downServices.length > 0) {
    statusLabel = 'CRITICAL';
    details = truncate(
      `${downServices.length} service(s) DOWN out of ${total}\n` +
        downServices.map((service, index) => `${index + 1}. ${service.name} — ${service.message || 'Down'}`).join('\n') +
        (degradedServices.length > 0 ? `\n\nDegraded: ${degradedServices.map((service) => service.name).join(', ')}` : '')
    );
  } else if (degradedServices.length > 0) {
    statusLabel = 'WARNING';
    details = truncate(
      `${degradedServices.length} service(s) degraded\nDegraded: ${degradedServices.map((service) => service.name).join(', ')}`
    );
  }

  const textMessage =
    downServices.length > 0
      ? `*MyFNG SYSTEM HEALTH REPORT*\n` +
        `_${timestamp}_\n\n` +
        `*Status: CRITICAL*\n` +
        `${downServices.length} service(s) DOWN out of ${total}\n\n` +
        `*DOWN Services:*\n` +
        downServices.map((service, index) => `${index + 1}. ${service.name} — ${service.message || 'Down'}`).join('\n') +
        (degradedServices.length > 0 ? `\n\n*Degraded:* ${degradedServices.map((service) => service.name).join(', ')}` : '') +
        `\n\n*Healthy:* ${healthy}/${total}` +
        `\n\n_Next check in 3 hours_`
      : degradedServices.length > 0
        ? `*MyFNG SYSTEM HEALTH REPORT*\n` +
          `_${timestamp}_\n\n` +
          `*Status: WARNING*\n` +
          `${degradedServices.length} service(s) degraded\n\n` +
          `*Degraded:* ${degradedServices.map((service) => service.name).join(', ')}\n` +
          `*Healthy:* ${healthy}/${total}` +
          `\n\n_Next check in 3 hours_`
        : `*MyFNG SYSTEM HEALTH REPORT*\n` +
          `_${timestamp}_\n\n` +
          `*Status: ALL SYSTEMS OPERATIONAL*\n` +
          `All ${total} services are healthy.\n\n` +
          `_Next check in 3 hours_`;

  return {
    statusLabel,
    details,
    textMessage,
    templateParams: [timestamp, statusLabel, details, String(healthy), String(total)],
  };
}

async function verifyTemplateOnMeta(templateName: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WhatsApp API credentials are not configured');
  }

  const url = `${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,status,language,category&limit=50&name=${encodeURIComponent(
    templateName
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
    data.find((row: any) => String(row?.name || '').trim().toLowerCase() === templateName.toLowerCase()) || null
  );
}

export async function getHealthAlertTemplateStatus(): Promise<HealthAlertTemplateStatus> {
  const templateName = SYSTEM_HEALTH_ALERT_TEMPLATE.template_name;
  const base: HealthAlertTemplateStatus = {
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
    // Ignore Meta lookup errors here; UI can still offer create/sync.
  }

  return base;
}

export async function createHealthAlertTemplate(actorId?: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WhatsApp API credentials are not configured');
  }

  const template = SYSTEM_HEALTH_ALERT_TEMPLATE;
  const existing = await verifyTemplateOnMeta(template.template_name).catch(() => null);
  if (existing) {
    return syncHealthAlertTemplate(actorId);
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

  return syncHealthAlertTemplate(actorId, metaResult);
}

export async function syncHealthAlertTemplate(actorId?: string, createResponse?: Record<string, unknown>) {
  const template = SYSTEM_HEALTH_ALERT_TEMPLATE;
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
      source: 'system_health_alert',
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
        ? 'Template is approved and ready for 24/7 alerts.'
        : 'Template submitted to Meta. Refresh status after Meta approves it (usually a few minutes).',
  };
}

export async function sendHealthAlertMessage(
  phoneNumber: string,
  summary: HealthAlertSummary,
  options?: { forceText?: boolean; test?: boolean }
) {
  const content = buildHealthAlertContent(summary);
  const textMessage = options?.test
    ? `*MyFNG SYSTEM ALERT - TEST*\n\nThis is a test alert from your System Monitor.\nIf you received this, WhatsApp alerts are working correctly.\n\n_Sent at: ${summary.timestamp}_`
    : content.textMessage;

  if (options?.forceText || options?.test) {
    return sendTextMessage(phoneNumber, textMessage);
  }

  const templateStatus = await getHealthAlertTemplateStatus();
  if (templateStatus.canSendTemplate) {
    return sendTemplateMessage({
      phoneNumber,
      templateName: SYSTEM_HEALTH_ALERT_TEMPLATE.template_name,
      templateParams: content.templateParams,
      languageCode: SYSTEM_HEALTH_ALERT_TEMPLATE.language_code,
    });
  }

  return sendTextMessage(phoneNumber, textMessage);
}
