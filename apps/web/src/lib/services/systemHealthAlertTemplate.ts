import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage, sendTextMessage } from '@/lib/services/whatsappService';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

/**
 * Fixed service order (matches System Monitor checks).
 * Names stay static in the Meta body so each service is on its own line;
 * variables only carry short status values (Meta forbids newlines in vars and
 * rejects templates with too many variables vs words — error 2388293).
 */
export const HEALTH_ALERT_SERVICE_NAMES = [
  'PostgreSQL Database',
  'Supabase Auth',
  'Supabase Storage',
  'WhatsApp Business API',
  'Razorpay Payment Gateway',
  'Firebase / FCM Admin',
  'Push Campaigns & Segments',
  'Push Device Registry',
  'Email (SMTP)',
  'Wallet System',
  'Advance Coupons',
  'Link Manager',
  'Universal Link',
  'RSA Leads',
  'OpenAI / AI Services',
  'MISA AI Monitoring',
  'WhatsApp AI Agents',
  'Google Maps',
  'Scheduled Jobs (Cron)',
  'Feature Cron Secrets',
  'SSL Certificate',
  'SARV / Deepcall Telephony',
] as const;

export const HEALTH_ALERT_SERVICE_SLOTS = HEALTH_ALERT_SERVICE_NAMES.length;

function metaServiceLabel(name: string) {
  // Keep labels Meta-safe and readable in the approved body text
  return name.replace(/&/g, 'and');
}

function buildLinedHealthAlertBody(names: readonly string[]) {
  const serviceLines = names.map((name, i) => `${metaServiceLabel(name)}: {{${i + 3}}}`);
  const healthyVar = names.length + 3;
  const totalVar = names.length + 4;
  return [
    'MyFNG System Health Report',
    '',
    'Time: {{1}}',
    'Status: {{2}}',
    '',
    'Per-service health status below:',
    ...serviceLines,
    '',
    `Healthy services count: {{${healthyVar}}} of {{${totalVar}}}.`,
    'Next automated check runs in 3 hours.',
  ].join('\n');
}

function buildHealthAlertExampleValues(slotCount: number) {
  const serviceExamples = Array.from({ length: slotCount }, (_, i) =>
    i === 8 ? 'DOWN - SMTP not configured' : 'OK'
  );
  return ['08/08/2026 4:10 PM', 'CRITICAL', ...serviceExamples, '21', '22'];
}

function buildHealthAlertVariableKeys(names: readonly string[]) {
  return [
    'timestamp',
    'status',
    ...names.map((_, i) => `service_${i + 1}`),
    'healthy_count',
    'total_count',
  ];
}

export const SYSTEM_HEALTH_ALERT_TEMPLATE = {
  template_name: 'system_health_alert_v2',
  display_name: 'System Health Alert V2',
  language_code: 'en',
  category: 'UTILITY',
  body_text: buildLinedHealthAlertBody(HEALTH_ALERT_SERVICE_NAMES),
  variable_keys: buildHealthAlertVariableKeys(HEALTH_ALERT_SERVICE_NAMES),
  example_values: buildHealthAlertExampleValues(HEALTH_ALERT_SERVICE_SLOTS),
} as const;

export type HealthAlertServiceLine = {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string;
};

export type HealthAlertSummary = {
  timestamp: string;
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  /** Full per-service list for WhatsApp body (preferred). */
  services?: HealthAlertServiceLine[];
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

/** Meta rejects newlines/tabs/>4 spaces inside template body variables (#132018). */
function sanitizeTemplateParam(value: string, max = 900) {
  const cleaned = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {5,}/g, '    ')
    .trim();
  return truncate(cleaned, max) || '-';
}

function statusMark(status: HealthAlertServiceLine['status']) {
  if (status === 'down') return 'DOWN';
  if (status === 'degraded') return 'WARN';
  return 'OK';
}

/** Short status for Meta vars (service name is already static in template body). */
function formatServiceStatusOnly(service?: HealthAlertServiceLine) {
  if (!service) return 'NOT CHECKED';
  const mark = statusMark(service.status);
  if (service.status === 'healthy') return mark;
  const msg = service.message ? ` - ${sanitizeTemplateParam(service.message, 50)}` : '';
  return sanitizeTemplateParam(`${mark}${msg}`, 80);
}

function formatServiceLine(service: HealthAlertServiceLine, index: number) {
  const mark = statusMark(service.status);
  const name = sanitizeTemplateParam(service.name, 60);
  const shortMessage =
    service.status === 'healthy'
      ? ''
      : service.message
        ? ` - ${sanitizeTemplateParam(service.message, 70)}`
        : '';
  return `${index + 1}. ${mark} ${name}${shortMessage}`;
}

function resolveServices(summary: HealthAlertSummary): HealthAlertServiceLine[] {
  if (Array.isArray(summary.services) && summary.services.length > 0) {
    return summary.services;
  }

  // Fallback when callers only send down/degraded arrays
  return [
    ...summary.downServices.map((service) => ({
      name: service.name,
      status: 'down' as const,
      message: service.message,
    })),
    ...summary.degradedServices.map((service) => ({
      name: service.name,
      status: 'degraded' as const,
    })),
  ];
}

function buildMultilineServiceDetails(services: HealthAlertServiceLine[]) {
  if (services.length === 0) return 'No services reported.';
  return services.map((service, index) => formatServiceLine(service, index)).join('\n');
}

/** One status param per fixed service name slot (no newlines — Meta #132018). */
function buildTemplateServiceParams(services: HealthAlertServiceLine[]) {
  const byName = new Map(services.map((service) => [service.name, service]));
  return HEALTH_ALERT_SERVICE_NAMES.map((name) => formatServiceStatusOnly(byName.get(name)));
}

export function buildHealthAlertContent(summary: HealthAlertSummary) {
  const { timestamp, total, healthy, downServices, degradedServices } = summary;
  const services = resolveServices(summary);

  let statusLabel = 'ALL SYSTEMS OPERATIONAL';
  if (downServices.length > 0) statusLabel = 'CRITICAL';
  else if (degradedServices.length > 0) statusLabel = 'WARNING';

  const detailsMultiline =
    services.length > 0
      ? buildMultilineServiceDetails(services)
      : healthy === total && total > 0
        ? `All ${total} services are healthy.`
        : 'No services reported.';

  const textMessage =
    `*MyFNG SYSTEM HEALTH REPORT*\n` +
    `_${timestamp}_\n\n` +
    `*Status: ${statusLabel}*\n\n` +
    `*Services:*\n` +
    detailsMultiline +
    `\n\n*Healthy:* ${healthy}/${total}` +
    `\n\n_Next check in 3 hours_`;

  const templateParams = [
    sanitizeTemplateParam(timestamp, 80),
    sanitizeTemplateParam(statusLabel, 80),
    ...buildTemplateServiceParams(services),
    sanitizeTemplateParam(String(healthy), 20),
    sanitizeTemplateParam(String(total), 20),
  ];

  return {
    statusLabel,
    details: detailsMultiline,
    textMessage,
    templateParams,
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
    console.error('Meta health template create failed:', metaResult);
    const msg =
      String(
        metaResult?.error?.error_user_msg ||
          metaResult?.error?.error_user_title ||
          metaResult?.error?.message ||
          ''
      ).trim() || 'Failed to create template on Meta';
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
    ? `*MyFNG SYSTEM ALERT - TEST*\n\n${content.textMessage}`
    : content.textMessage;

  // forceText: plain WhatsApp text (supports real line breaks). Template path is separate.
  if (options?.forceText) {
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
