import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getAutomationSetting,
  isAutomationTemplateApproved,
  type WhatsAppAutomationSetting,
  type WhatsAppAutomationTriggerKey,
} from '@/lib/services/whatsappAutomation';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

export const WHATSAPP_AUTOMATION_TEMPLATE_EXAMPLES: Record<WhatsAppAutomationTriggerKey, string[]> = {
  booking_confirmed: [
    'Rahul Sharma',
    'L-12345678',
    'Honda City (MH01AB1234)',
    'Periodic Service | ₹2,499',
    '15 Jul 2026, 10:00 AM | Doorstep pickup | Flat 201, Kapur Bawadi, Near ABC Mall, Thane 400601',
  ],
  booking_updated: [
    'Rahul Sharma',
    'L-12345678',
    'Honda City (MH01AB1234)',
    'General Service | ₹3,499',
    '15 Jul 2026, 10:00 AM | Doorstep pickup | Flat 201, Kapur Bawadi, Near ABC Mall, Thane 400601',
  ],
  booking_incomplete: ['Rahul Sharma', 'Honda City', 'Periodic Service'],
  membership_payment_success: ['Rahul Sharma', '699', 'MyFNG Prime', 'pay_ABC123'],
  membership_payment_failed: ['Rahul Sharma', '699', 'MyFNG Prime'],
  app_session_incomplete: ['Rahul Sharma'],
  admin_daily_summary: ['13 Jul 2026', '24', '3', '45000', '5', '1'],
  service_due_reminder: ['Rahul Sharma', 'Honda City', 'MH01AB1234', '12 Jan 2026'],
  membership_expiring: ['Rahul Sharma', '31 Jul 2026'],
  membership_claim_submitted: ['Rahul Sharma', 'Free Car Scanning', 'MH02FJ7371'],
  membership_claim_approved: ['Rahul Sharma', 'Free Car Scanning', 'MH02FJ7371', 'L-12345678'],
  membership_claim_rejected: ['Rahul Sharma', 'Free Car Scanning', 'MH02FJ7371'],
  account_deleted: ['Rahul Sharma'],
  app_uninstalled: ['Rahul Sharma'],
};

async function resolveMembershipPrimePrice(): Promise<number> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return 699;

  const { data } = await supabaseAdmin
    .from('membership_plans')
    .select('price, display_order, active, code')
    .eq('active', true)
    .order('display_order', { ascending: true })
    .limit(10);

  const prime = (data || []).find((row) => String(row.code || '').toUpperCase().includes('PRIME'));
  const price = Number((prime || data?.[0])?.price || 699);
  return Number.isFinite(price) && price > 0 ? price : 699;
}

export async function getAutomationTemplateExamples(
  triggerKey: WhatsAppAutomationTriggerKey
): Promise<string[]> {
  const base = WHATSAPP_AUTOMATION_TEMPLATE_EXAMPLES[triggerKey] || [];
  if (triggerKey !== 'membership_payment_success' && triggerKey !== 'membership_payment_failed') {
    return [...base];
  }

  const price = String(await resolveMembershipPrimePrice());
  const copy = [...base];
  if (copy.length >= 2) copy[1] = price;
  return copy;
}

export type AutomationTemplateStatus = {
  triggerKey: WhatsAppAutomationTriggerKey;
  templateName: string;
  exists: boolean;
  isApproved: boolean;
  metaStatus: string | null;
  metaCategory: string | null;
  templateId: string | null;
  canSendTemplate: boolean;
  isUtilityCategory: boolean;
};

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

export async function getAutomationTemplateStatus(
  triggerKey: WhatsAppAutomationTriggerKey
): Promise<AutomationTemplateStatus> {
  const setting = await getAutomationSetting(triggerKey);
  const templateName = setting?.template_name || triggerKey;
  const base: AutomationTemplateStatus = {
    triggerKey,
    templateName,
    exists: false,
    isApproved: false,
    metaStatus: null,
    metaCategory: null,
    templateId: null,
    canSendTemplate: false,
    isUtilityCategory: false,
  };

  if (!setting) return base;

  const readCategory = (row: { category?: string | null; meta?: { category?: string } | null } | null) =>
    String(row?.category || row?.meta?.category || '').trim().toUpperCase() || null;

  const isUtilityCategory = (category: string | null) => !category || category === 'UTILITY';

  const approved = await isAutomationTemplateApproved(setting.template_name);
  if (approved) {
    const { supabaseAdmin } = getSupabaseAdmin();
    const { data } = supabaseAdmin
      ? await supabaseAdmin
          .from('whatsapp_templates')
          .select('meta, category')
          .eq('template_name', setting.template_name)
          .maybeSingle()
      : { data: null };

    const metaCategory = readCategory(data as any);
    const utilityOk = isUtilityCategory(metaCategory);
    const metaStatus = String((data as any)?.meta?.status || 'APPROVED').toUpperCase();
    base.exists = true;
    base.isApproved = true;
    base.metaStatus = metaStatus;
    base.metaCategory = metaCategory;
    base.templateId = String((data as any)?.meta?.template_id || '') || null;
    base.isUtilityCategory = utilityOk;
    base.canSendTemplate = utilityOk;
    return base;
  }

  try {
    const verified = await verifyTemplateOnMeta(setting.template_name);
    if (verified) {
      const metaStatus = String(verified?.status || '').toUpperCase();
      const metaCategory = readCategory({
        category: String(verified?.category || ''),
        meta: { category: String(verified?.category || '') },
      });
      const utilityOk = isUtilityCategory(metaCategory);
      base.exists = true;
      base.metaStatus = metaStatus;
      base.metaCategory = metaCategory;
      base.templateId = String(verified?.id || '') || null;
      base.isApproved = metaStatus === 'APPROVED';
      base.isUtilityCategory = utilityOk;
      base.canSendTemplate = base.isApproved && utilityOk;
    }
  } catch {
    // ignore lookup errors
  }

  return base;
}

async function upsertLocalTemplateFromSetting(
  setting: WhatsAppAutomationSetting,
  verified: Record<string, unknown> | null,
  actorId?: string,
  createResponse?: Record<string, unknown>
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin client is not available');

  const metaStatus = String(verified?.status || 'PENDING').toUpperCase();
  const exampleValues = await getAutomationTemplateExamples(setting.trigger_key as WhatsAppAutomationTriggerKey);

  const { data: existingTemplate } = await supabaseAdmin
    .from('whatsapp_templates')
    .select('is_active')
    .eq('template_name', setting.template_name)
    .maybeSingle();

  const row = {
    template_name: setting.template_name,
    display_name: setting.display_name,
    language_code: setting.template_language || 'en',
    category: String(verified?.category || setting.template_category || 'UTILITY').toUpperCase(),
    body_text: setting.template_body,
    variable_keys: setting.variable_keys,
    example_values: exampleValues,
    is_active:
      existingTemplate?.is_active !== undefined && existingTemplate?.is_active !== null
        ? Boolean(existingTemplate.is_active)
        : metaStatus === 'APPROVED',
    meta: {
      source: 'whatsapp_automation',
      trigger_key: setting.trigger_key,
      status: metaStatus,
      template_id: verified?.id || null,
      category: verified?.category || setting.template_category,
      language: verified?.language || setting.template_language,
      synced_at: new Date().toISOString(),
      raw: {
        create_response: createResponse || null,
        verify_response: verified,
      },
    },
    updated_at: new Date().toISOString(),
    ...(actorId ? { created_by: actorId } : {}),
  };

  const { error } = await supabaseAdmin.from('whatsapp_templates').upsert(row, { onConflict: 'template_name' });
  if (error) throw new Error(error.message || 'Failed to save template locally');

  return {
    metaStatus,
    isApproved: metaStatus === 'APPROVED',
    message:
      metaStatus === 'APPROVED'
        ? 'Template is approved and ready to send.'
        : 'Template submitted to Meta. Refresh status after approval.',
  };
}

function countTemplateVariables(templateBody: string): number {
  const matches = templateBody.match(/\{\{\d+\}\}/g) || [];
  const indices = matches.map((token) => Number(token.replace(/[{}]/g, '')));
  return indices.length ? Math.max(...indices) : 0;
}

function buildExampleValuesForTemplate(
  triggerKey: WhatsAppAutomationTriggerKey,
  templateBody: string,
  examples: string[]
): string[] {
  const count = countTemplateVariables(templateBody);
  if (count <= 0) return [];

  const values = [...examples];
  while (values.length < count) {
    values.push(`sample_${values.length + 1}`);
  }
  return values.slice(0, count);
}

function formatMetaApiError(metaResult: Record<string, unknown>): string {
  const err = (metaResult?.error || {}) as Record<string, unknown>;
  const parts = [
    err.error_user_msg,
    err.error_user_title,
    err.message,
    err.error_subcode ? `subcode ${err.error_subcode}` : null,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return parts.join(' — ') || 'Failed to create template on Meta';
}

export async function createAutomationTemplateFromSetting(
  triggerKey: WhatsAppAutomationTriggerKey,
  actorId?: string
) {
  const setting = await getAutomationSetting(triggerKey);
  if (!setting) throw new Error(`Automation trigger "${triggerKey}" is not configured`);

  const existing = await verifyTemplateOnMeta(setting.template_name).catch(() => null);
  if (existing) {
    const existingStatus = String(existing?.status || '').toUpperCase();
    if (existingStatus === 'REJECTED') {
      throw new Error(
        `Meta rejected template "${setting.template_name}". Run database/262_goodbye_templates_meta_utility.sql for a new template name, refresh this page, then submit again.`
      );
    }
    return syncAutomationTemplateFromSetting(triggerKey, actorId);
  }

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    throw new Error('WhatsApp API credentials are not configured');
  }

  const rawExamples = await getAutomationTemplateExamples(triggerKey);
  const exampleValues = buildExampleValuesForTemplate(
    triggerKey,
    setting.template_body,
    rawExamples
  );

  const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: setting.template_name,
      language: setting.template_language || 'en',
      category: setting.template_category || 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: setting.template_body,
          example: {
            body_text: [exampleValues],
          },
        },
      ],
    }),
    cache: 'no-store',
  });

  const metaResult = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatMetaApiError(metaResult as Record<string, unknown>));
  }

  try {
    return await syncAutomationTemplateFromSetting(triggerKey, actorId, metaResult);
  } catch (syncError: any) {
    const verified = await verifyTemplateOnMeta(setting.template_name).catch(() => null);
    if (verified) {
      return syncAutomationTemplateFromSetting(triggerKey, actorId, metaResult);
    }

    const pendingStatus = String(metaResult?.status || 'PENDING').toUpperCase();
    const fallbackVerified = {
      id: metaResult?.id || null,
      status: pendingStatus,
      name: setting.template_name,
      category: metaResult?.category || setting.template_category,
      language: metaResult?.language || setting.template_language,
    };

    const result = await upsertLocalTemplateFromSetting(
      setting,
      fallbackVerified,
      actorId,
      metaResult
    );
    const templateStatus = await getAutomationTemplateStatus(triggerKey);
    return {
      ...result,
      templateStatus,
      setting,
      warning:
        syncError?.message ||
        'Template submitted to Meta. Refresh status in 1-2 minutes if not visible yet.',
    };
  }
}

export async function syncAutomationTemplateFromSetting(
  triggerKey: WhatsAppAutomationTriggerKey,
  actorId?: string,
  createResponse?: Record<string, unknown>
) {
  const setting = await getAutomationSetting(triggerKey);
  if (!setting) throw new Error(`Automation trigger "${triggerKey}" is not configured`);

  const verified = await verifyTemplateOnMeta(setting.template_name);
  if (!verified) {
    throw new Error('Template not found on Meta yet. Create it first or wait a minute and refresh.');
  }

  const result = await upsertLocalTemplateFromSetting(setting, verified, actorId, createResponse);
  const templateStatus = await getAutomationTemplateStatus(triggerKey);
  return { ...result, templateStatus, setting };
}

export async function setAutomationTriggerEnabled(triggerKey: WhatsAppAutomationTriggerKey, isEnabled: boolean) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin client is not available');

  const { data, error } = await supabaseAdmin
    .from('whatsapp_automation_settings')
    .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq('trigger_key', triggerKey)
    .select('trigger_key, is_enabled')
    .single();

  if (error) throw new Error(error.message || 'Failed to update trigger');
  return data;
}

export async function setAutomationTriggerCronEnabled(
  triggerKey: WhatsAppAutomationTriggerKey,
  cronEnabled: boolean,
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin client is not available');

  const { data, error } = await supabaseAdmin
    .from('whatsapp_automation_settings')
    .update({ cron_enabled: cronEnabled, updated_at: new Date().toISOString() })
    .eq('trigger_key', triggerKey)
    .select('trigger_key, cron_enabled')
    .single();

  if (error) throw new Error(error.message || 'Failed to update cron setting');
  return data;
}
