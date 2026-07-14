import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getResolvedWhatsAppAgentsCredentials,
  loadWhatsAppAgentsEnvConfig,
  resolveActiveWhatsAppAgentsCredentials,
} from './envConfigStore';

export type AgentsHealthResult = {
  ok: boolean;
  credentials_source: 'database' | 'environment' | 'none';
  openai: { ok: boolean; message: string };
  whatsapp: { ok: boolean; message: string };
  cron: { ok: boolean; message: string };
  telecrm: { ok: boolean; message: string };
  supabase_admin: { ok: boolean; message: string };
};

export async function checkWhatsAppAgentsCredentials(): Promise<AgentsHealthResult> {
  const config = await loadWhatsAppAgentsEnvConfig();
  const creds = resolveActiveWhatsAppAgentsCredentials(config);
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();

  const result: AgentsHealthResult = {
    ok: false,
    credentials_source: creds.source,
    openai: { ok: false, message: 'Not configured' },
    whatsapp: { ok: false, message: 'Not configured' },
    cron: { ok: false, message: 'Not configured' },
    telecrm: { ok: false, message: 'Not configured' },
    supabase_admin: { ok: false, message: adminError || 'Not configured' },
  };

  if (creds.openai_api_key.trim()) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${creds.openai_api_key}` },
      });
      if (response.ok) {
        result.openai = { ok: true, message: 'OpenAI API reachable' };
      } else {
        const text = await response.text();
        result.openai = { ok: false, message: `OpenAI error (${response.status}): ${text.slice(0, 120)}` };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.openai = { ok: false, message: msg };
    }
  }

  if (creds.whatsapp_access_token.trim() && creds.whatsapp_phone_number_id.trim()) {
    try {
      const url = `${creds.whatsapp_api_url}/${creds.whatsapp_phone_number_id}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${creds.whatsapp_access_token}` },
      });
      if (response.ok) {
        result.whatsapp = { ok: true, message: 'WhatsApp Cloud API reachable' };
      } else {
        const text = await response.text();
        result.whatsapp = { ok: false, message: `WhatsApp error (${response.status}): ${text.slice(0, 120)}` };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.whatsapp = { ok: false, message: msg };
    }
  }

  if (creds.cron_secret.trim()) {
    result.cron = { ok: true, message: 'Cron secret configured' };
  }

  if (creds.telecrm_webhook_secret.trim()) {
    result.telecrm = { ok: true, message: 'TeleCRM webhook secret configured' };
  } else if (creds.cron_secret.trim()) {
    result.telecrm = { ok: true, message: 'Using CRON_SECRET fallback' };
  }

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('whatsapp_agent_configs').select('agent_type').limit(1);
    result.supabase_admin = error
      ? { ok: false, message: error.message }
      : { ok: true, message: 'Supabase service role OK' };
  }

  result.ok =
    result.openai.ok &&
    result.whatsapp.ok &&
    result.cron.ok &&
    result.telecrm.ok &&
    result.supabase_admin.ok;

  return result;
}

export async function refreshAndCheckAgentsCredentials(): Promise<AgentsHealthResult> {
  await getResolvedWhatsAppAgentsCredentials(true);
  return checkWhatsAppAgentsCredentials();
}
