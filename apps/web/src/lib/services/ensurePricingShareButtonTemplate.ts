import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getResolvedWhatsAppAgentsCredentials,
  type ResolvedWhatsAppAgentsCredentials,
} from '@/lib/whatsappAgents/shared/envConfigStore';
import {
  pushWhatsAppTemplateToMeta,
  type WhatsAppTemplatePushResult,
} from '@/lib/services/whatsappTemplateMetaPush';
import { resolveWabaForTemplates } from '@/lib/services/whatsappTemplateWabaResolve';
import { isOtpWhatsAppLine } from '@/lib/services/whatsappService';

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

async function upsertLocalPricingShareRow() {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false as const, message: adminError || 'Admin DB not configured' };
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
    return { ok: false as const, message: upsertError.message || 'Failed to save local template' };
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('whatsapp_templates')
    .select(
      'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, meta',
    )
    .eq('template_name', PRICING_SHARE_BTN_TEMPLATE_NAME)
    .maybeSingle();

  if (fetchError || !row?.id) {
    return { ok: false as const, message: fetchError?.message || 'Template row missing after upsert' };
  }

  return { ok: true as const, row, supabaseAdmin };
}

function credsFromResolved(input: {
  apiUrl: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
}): ResolvedWhatsAppAgentsCredentials {
  return {
    openai_api_key: '',
    whatsapp_access_token: input.accessToken,
    whatsapp_phone_number_id: input.phoneNumberId.replace(/\D/g, ''),
    whatsapp_business_account_id: input.wabaId.replace(/\D/g, ''),
    whatsapp_api_url: input.apiUrl.replace(/\/$/, ''),
    whatsapp_app_secret: '',
    whatsapp_webhook_verify_token: '',
    cron_secret: '',
    telecrm_webhook_secret: '',
    source: 'environment',
  };
}

export async function ensurePricingShareButtonForAccount(input: {
  apiUrl: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone?: string;
}): Promise<{
  success: boolean;
  message: string;
  templateId?: string;
  metaStatus?: string;
  wabaId: string;
  display_phone?: string;
}> {
  const saved = await upsertLocalPricingShareRow();
  if (!saved.ok) {
    return { success: false, message: saved.message, wabaId: input.wabaId };
  }

  const creds = credsFromResolved({
    apiUrl: input.apiUrl,
    accessToken: input.accessToken,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
  });

  try {
    const push: WhatsAppTemplatePushResult = await pushWhatsAppTemplateToMeta(saved.row as any, {
      creds,
      skipLocalMetaUpdate: true,
    });
    const phoneLabel = input.displayPhone || input.phoneNumberId;
    return {
      success: true,
      templateId: saved.row.id,
      wabaId: input.wabaId,
      metaStatus: push.metaStatus,
      display_phone: input.displayPhone,
      message:
        push.message ||
        `pricing_share_link_btn submitted on ${phoneLabel} WABA (${push.metaStatus}). Dono numbers isi WABA par ho to ek push kaafi hai.`,
    };
  } catch (e: unknown) {
    return {
      success: false,
      templateId: saved.row.id,
      wabaId: input.wabaId,
      message: String((e as { message?: string })?.message || 'Meta push failed'),
    };
  }
}

export async function ensurePricingShareButtonTemplateOnMeta(): Promise<{
  success: boolean;
  message: string;
  templateId?: string;
  wabaResults: PricingShareWabaPushResult[];
}> {
  const saved = await upsertLocalPricingShareRow();
  if (!saved.ok) {
    return { success: false, message: saved.message, wabaResults: [] };
  }

  const { row, supabaseAdmin } = saved;
  const wabaResults: PricingShareWabaPushResult[] = [];
  const pushedWabaIds = new Set<string>();

  const pushOne = async (
    creds: ResolvedWhatsAppAgentsCredentials,
    label: string,
    updateLocal: boolean,
  ) => {
    const wabaId = String(creds.whatsapp_business_account_id || '').replace(/\D/g, '');
    if (!wabaId) {
      wabaResults.push({
        label,
        wabaId: '—',
        ok: false,
        message: 'Missing WABA id',
      });
      return;
    }
    if (pushedWabaIds.has(wabaId)) {
      wabaResults.push({
        label,
        wabaId,
        ok: true,
        message: 'Same WABA — template already submitted (6161 + 00505 dono is number par chal sakte hain)',
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

  let settingsCreds: ResolvedWhatsAppAgentsCredentials | null = null;
  try {
    settingsCreds = await getResolvedWhatsAppAgentsCredentials(true);
    const settingsWaba = String(settingsCreds.whatsapp_business_account_id || '').replace(/\D/g, '');
    const settingsPhone = String(settingsCreds.whatsapp_phone_number_id || '').replace(/\D/g, '');
    const resolvedSettingsWaba =
      settingsPhone && settingsCreds.whatsapp_access_token
        ? await resolveWabaForTemplates(
            settingsCreds.whatsapp_api_url,
            settingsCreds.whatsapp_access_token,
            settingsPhone,
            settingsWaba,
          )
        : settingsWaba;
    if (resolvedSettingsWaba && resolvedSettingsWaba !== settingsWaba) {
      settingsCreds = {
        ...settingsCreds,
        whatsapp_business_account_id: resolvedSettingsWaba,
      };
    }
    await pushOne(settingsCreds, '+91 95949 96161 (settings)', true);
  } catch (e: unknown) {
    wabaResults.push({
      label: '+91 95949 96161 (settings)',
      wabaId: '—',
      ok: false,
      message: String((e as { message?: string })?.message || 'Settings WABA not configured'),
    });
  }

  const { data: bulkAccounts } = await supabaseAdmin
    .from('wa_bulk_accounts')
    .select('id, label, display_phone, phone_number_id, waba_id, access_token, api_url, is_active')
    .order('created_at', { ascending: true });

  for (const account of bulkAccounts || []) {
    const phoneNumberId = String(account.phone_number_id || '').replace(/\D/g, '');
    let accessToken = String(account.access_token || '').trim();
    if (!accessToken && settingsCreds?.whatsapp_access_token) {
      accessToken = String(settingsCreds.whatsapp_access_token).trim();
    }
    const apiUrl = String(account.api_url || settingsCreds?.whatsapp_api_url || 'https://graph.facebook.com/v25.0').replace(
      /\/$/,
      '',
    );
    const label =
      account.display_phone ||
      (isOtpWhatsAppLine(String(account.display_phone || ''), phoneNumberId) ? '+91 95949 00505' : 'Connected number');

    if (!accessToken || !phoneNumberId) {
      wabaResults.push({
        label: String(label),
        wabaId: String(account.waba_id || '—'),
        ok: false,
        message: 'Missing access token or phone_number_id',
      });
      continue;
    }

    const providedWaba = String(account.waba_id || '').replace(/\D/g, '');
    const wabaId = await resolveWabaForTemplates(apiUrl, accessToken, phoneNumberId, providedWaba);
    if (!wabaId) {
      wabaResults.push({
        label: String(label),
        wabaId: providedWaba || '—',
        ok: false,
        message: 'WABA resolve failed — paste asset_id on Bulk WhatsApp account card',
      });
      continue;
    }

    if (providedWaba !== wabaId) {
      await supabaseAdmin.from('wa_bulk_accounts').update({ waba_id: wabaId }).eq('id', account.id);
    }

    const creds = credsFromResolved({ apiUrl, accessToken, wabaId, phoneNumberId });
    const pushLabel = `${label}${account.label ? ` (${account.label})` : ''}`;
    await pushOne(creds, pushLabel, false);
  }

  const okCount = wabaResults.filter((r) => r.ok).length;
  const failCount = wabaResults.length - okCount;
  const success = okCount > 0;

  const summary =
    failCount === 0
      ? `pricing_share_link_btn — ${okCount} WABA(s) (6161 + 00505 / connected).`
      : `${okCount} OK, ${failCount} failed — 00505 ke liye account select karke bhi Push try karo.`;

  return {
    success,
    templateId: row.id,
    wabaResults,
    message: summary,
  };
}