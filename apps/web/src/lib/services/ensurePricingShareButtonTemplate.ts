import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getResolvedWhatsAppAgentsCredentials,
  type ResolvedWhatsAppAgentsCredentials,
} from '@/lib/whatsappAgents/shared/envConfigStore';
import {
  pushWhatsAppTemplateToMeta,
  type WhatsAppTemplatePushResult,
} from '@/lib/services/whatsappTemplateMetaPush';

export const PRICING_SHARE_BTN_TEMPLATE_NAME = 'pricing_share_link_btn';

const BODY_TEXT = `Hi {{1}},

Sharing MyFNG *full service pricing* for *{{2}}*.

View all packages (Periodic, AC, Engine, Denting & more) — valid until {{3}}.

Select plans on the page and send back on WhatsApp, or reply *BOOK*. — Team MyFNG`;

const META_PAYLOAD = {
  purpose: 'telecaller_pricing_share',
  source: 'local_draft',
  pricing_slug_button: true,
  meta_submit_note:
    'UTILITY — pricing copy with URL on CTA button "Pricing link" (dynamic slug). No raw link in body.',
  status: 'NOT_SYNCED',
  meta_components: [
    {
      type: 'BODY',
      text: BODY_TEXT,
      example: {
        body_text: [['Yunick', 'MARUTI WAGON R', '28 Jul, 08:21 pm']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: 'Pricing link',
          url: 'https://myfng.in/pricing/{{1}}',
          example: ['ukpjtath3f'],
        },
      ],
    },
  ],
};

export type PricingShareWabaPushResult = {
  label: string;
  wabaId: string;
  ok: boolean;
  metaStatus?: string;
  message: string;
};

function credsFromBulkAccount(row: {
  access_token?: string | null;
  phone_number_id?: string | null;
  waba_id?: string | null;
  api_url?: string | null;
  display_phone?: string | null;
  label?: string | null;
}): ResolvedWhatsAppAgentsCredentials | null {
  const token = String(row.access_token || '').trim();
  const wabaId = String(row.waba_id || '').replace(/\D/g, '');
  const phoneNumberId = String(row.phone_number_id || '').replace(/\D/g, '');
  if (!token || !wabaId || !phoneNumberId) return null;
  return {
    openai_api_key: '',
    whatsapp_access_token: token,
    whatsapp_phone_number_id: phoneNumberId,
    whatsapp_business_account_id: wabaId,
    whatsapp_api_url: String(row.api_url || 'https://graph.facebook.com/v25.0').replace(/\/$/, ''),
    whatsapp_app_secret: '',
    whatsapp_webhook_verify_token: '',
    cron_secret: '',
    telecrm_webhook_secret: '',
    source: 'environment',
  };
}

export async function ensurePricingShareButtonTemplateOnMeta(): Promise<{
  success: boolean;
  message: string;
  templateId?: string;
  wabaResults: PricingShareWabaPushResult[];
}> {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, message: adminError || 'Admin DB not configured', wabaResults: [] };
  }

  const upsertRow = {
    template_name: PRICING_SHARE_BTN_TEMPLATE_NAME,
    display_name: 'Pricing Share Link · URL button',
    language_code: 'en',
    category: 'UTILITY',
    body_text: BODY_TEXT,
    variable_keys: ['customer_name', 'car_model', 'expiry_date_time'],
    example_values: ['Yunick', 'MARUTI WAGON R', '28 Jul, 08:21 pm'],
    is_active: true,
    meta: META_PAYLOAD,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabaseAdmin
    .from('whatsapp_templates')
    .upsert(upsertRow, { onConflict: 'template_name' });

  if (upsertError) {
    return { success: false, message: upsertError.message || 'Failed to save local template', wabaResults: [] };
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('whatsapp_templates')
    .select(
      'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, meta',
    )
    .eq('template_name', PRICING_SHARE_BTN_TEMPLATE_NAME)
    .maybeSingle();

  if (fetchError || !row?.id) {
    return {
      success: false,
      message: fetchError?.message || 'Template row missing after upsert',
      wabaResults: [],
    };
  }

  const wabaResults: PricingShareWabaPushResult[] = [];
  const pushedWabaIds = new Set<string>();

  const pushOne = async (
    creds: ResolvedWhatsAppAgentsCredentials,
    label: string,
    updateLocal: boolean,
  ) => {
    const wabaId = String(creds.whatsapp_business_account_id || '').replace(/\D/g, '');
    if (!wabaId || pushedWabaIds.has(wabaId)) {
      wabaResults.push({
        label,
        wabaId: wabaId || '—',
        ok: true,
        message: wabaId ? 'Skipped — same WABA already pushed' : 'Skipped — missing WABA id',
      });
      return;
    }
    pushedWabaIds.add(wabaId);
    try {
      const push: WhatsAppTemplatePushResult = await pushWhatsAppTemplateToMeta(row as any, {
        creds,
        skipLocalMetaUpdate: !updateLocal,
      });
      wabaResults.push({
        label,
        wabaId,
        ok: true,
        metaStatus: push.metaStatus,
        message: push.message,
      });
    } catch (e: unknown) {
      wabaResults.push({
        label,
        wabaId,
        ok: false,
        message: String((e as { message?: string })?.message || 'Meta push failed'),
      });
    }
  };

  try {
    const settingsCreds = await getResolvedWhatsAppAgentsCredentials(true);
    await pushOne(
      settingsCreds,
      settingsCreds.whatsapp_phone_number_id
        ? `Settings · ${settingsCreds.whatsapp_business_account_id}`
        : 'Settings WABA (env)',
      true,
    );
  } catch (e: unknown) {
    wabaResults.push({
      label: 'Settings WABA (env)',
      wabaId: '—',
      ok: false,
      message: String((e as { message?: string })?.message || 'Settings WABA not configured'),
    });
  }

  // Every connected number (not only the active send account) may be on a different WABA.
  const { data: bulkAccounts } = await supabaseAdmin
    .from('wa_bulk_accounts')
    .select('id, label, display_phone, phone_number_id, waba_id, access_token, api_url, is_active')
    .order('created_at', { ascending: true });

  for (const account of bulkAccounts || []) {
    const creds = credsFromBulkAccount(account);
    if (!creds) {
      wabaResults.push({
        label: String(account.label || account.display_phone || 'Connected account'),
        wabaId: String(account.waba_id || '—'),
        ok: false,
        message: 'Missing token, WABA id, or phone_number_id on this account',
      });
      continue;
    }
    const label = `${account.label || account.display_phone || 'Connected'} · ${account.display_phone || ''}`.trim();
    await pushOne(creds, label, false);
  }

  const okCount = wabaResults.filter((r) => r.ok).length;
  const failCount = wabaResults.length - okCount;
  const success = okCount > 0;

  const summary =
    failCount === 0
      ? `pricing_share_link_btn submitted on ${okCount} WABA(s).`
      : `${okCount} WABA OK, ${failCount} failed — see details.`;

  return {
    success,
    templateId: row.id,
    wabaResults,
    message: summary,
  };
}