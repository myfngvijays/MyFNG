import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getResolvedWhatsAppAgentsCredentials,
  type ResolvedWhatsAppAgentsCredentials,
} from '@/lib/whatsappAgents/shared/envConfigStore';
import {
  ensureOtpTemplateOnCurrentWaba,
  isAuthenticationOtpTemplate,
} from '@/lib/services/whatsappAuthenticationOtpTemplate';

export type WhatsAppTemplatePushRow = {
  id: string;
  template_name: string;
  display_name?: string | null;
  language_code: string;
  category: string;
  body_text: string;
  variable_keys?: string[] | null;
  example_values?: string[] | null;
};

export type WhatsAppTemplatePushResult = {
  template_name: string;
  action: 'created' | 'linked' | 'skipped';
  metaStatus: string;
  message: string;
};

export async function getWhatsAppTemplatePushConfig() {
  const creds = await getResolvedWhatsAppAgentsCredentials(true);
  return {
    apiUrl: creds.whatsapp_api_url,
    accessToken: creds.whatsapp_access_token,
    businessAccountId: creds.whatsapp_business_account_id,
    source: creds.source,
  };
}

export async function assertWhatsAppTemplatePushConfig() {
  const creds = await getResolvedWhatsAppAgentsCredentials(true);
  if (!creds.whatsapp_access_token?.trim()) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  }
  if (!creds.whatsapp_business_account_id?.trim()) {
    throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
  }
  return creds;
}

export async function verifyTemplateOnMeta(templateName: string, creds?: ResolvedWhatsAppAgentsCredentials) {
  const activeCreds = creds || (await assertWhatsAppTemplatePushConfig());

  const url = `${activeCreds.whatsapp_api_url}/${activeCreds.whatsapp_business_account_id}/message_templates?fields=id,name,status,language,category&limit=50&name=${encodeURIComponent(
    templateName,
  )}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${activeCreds.whatsapp_access_token}` },
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

async function createTemplateOnMeta(
  creds: ResolvedWhatsAppAgentsCredentials,
  payload: {
    template_name: string;
    language_code: string;
    category: string;
    body_text: string;
    example_values?: string[];
  },
) {
  const exampleValues = Array.isArray(payload.example_values)
    ? payload.example_values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const response = await fetch(
    `${creds.whatsapp_api_url}/${creds.whatsapp_business_account_id}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.whatsapp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: payload.template_name,
        language: payload.language_code,
        category: payload.category,
        components: [
          {
            type: 'BODY',
            text: payload.body_text,
            ...(exampleValues.length > 0
              ? {
                  example: {
                    body_text: [exampleValues],
                  },
                }
              : {}),
          },
        ],
      }),
      cache: 'no-store',
    },
  );

  const metaResult = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(metaResult?.error?.error_user_msg || metaResult?.error?.message || '').trim() ||
      'Failed to create template on Meta';
    throw new Error(msg);
  }

  return metaResult;
}

function isAlreadyOnMetaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already exists') ||
    normalized.includes('already english content') ||
    normalized.includes('already content for this template')
  );
}

export async function pushWhatsAppTemplateToMeta(
  localTemplate: WhatsAppTemplatePushRow,
  options?: { skipIfOnMeta?: boolean },
): Promise<WhatsAppTemplatePushResult> {
  const templateName = String(localTemplate.template_name);
  const skipIfOnMeta = options?.skipIfOnMeta !== false;
  const creds = await assertWhatsAppTemplatePushConfig();

  if (isAuthenticationOtpTemplate(templateName, localTemplate.category)) {
    const result = await ensureOtpTemplateOnCurrentWaba();
    if (!result.success) {
      throw new Error(result.message);
    }
    return {
      template_name: templateName,
      action: result.action === 'already_approved' || result.action === 'linked' ? 'linked' : 'created',
      metaStatus: result.metaStatus,
      message: result.message,
    };
  }

  const existingOnMeta = await verifyTemplateOnMeta(templateName, creds);
  if (existingOnMeta) {
    const metaStatus = String(existingOnMeta?.status || 'PENDING').toUpperCase();
    if (skipIfOnMeta && ['APPROVED', 'PENDING', 'IN_APPEAL'].includes(metaStatus)) {
      await updateLocalTemplateMeta(localTemplate.id, existingOnMeta, 'meta_repush_linked');
      return {
        template_name: templateName,
        action: 'linked',
        metaStatus,
        message:
          metaStatus === 'APPROVED'
            ? 'Already approved on this WABA.'
            : `Already on Meta with status ${metaStatus}.`,
      };
    }
  }

  try {
    await createTemplateOnMeta(creds, {
      template_name: templateName,
      language_code: String(localTemplate.language_code || 'en'),
      category: String(localTemplate.category || 'UTILITY'),
      body_text: String(localTemplate.body_text || ''),
      example_values: Array.isArray(localTemplate.example_values)
        ? localTemplate.example_values.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    });
  } catch (error: unknown) {
    const message = String((error as { message?: string })?.message || '');
    if (!isAlreadyOnMetaError(message)) throw error;
  }

  const verified = await verifyTemplateOnMeta(templateName, creds);
  if (!verified) {
    throw new Error(`Template not verifiable on WABA ${creds.whatsapp_business_account_id} after push.`);
  }

  const metaStatus = String(verified?.status || 'PENDING').toUpperCase();
  await updateLocalTemplateMeta(localTemplate.id, verified, 'meta_repush_create');

  return {
    template_name: templateName,
    action: 'created',
    metaStatus,
    message:
      metaStatus === 'APPROVED'
        ? 'Template linked to Meta and approved.'
        : `Template submitted to Meta with status ${metaStatus}.`,
  };
}

async function updateLocalTemplateMeta(
  templateId: string,
  verified: Record<string, unknown>,
  source: 'meta_repush_linked' | 'meta_repush_create' | 'meta_push_existing',
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin client is not available');

  const metaStatus = String(verified?.status || 'PENDING').toUpperCase();
  const { error } = await supabaseAdmin
    .from('whatsapp_templates')
    .update({
      is_active: metaStatus === 'APPROVED',
      meta: {
        source,
        status: metaStatus,
        template_id: verified?.id || null,
        category: verified?.category || null,
        language: verified?.language || null,
        pushed_at: new Date().toISOString(),
        raw: verified,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId);

  if (error) throw new Error(error.message || 'Failed to update local template');
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
