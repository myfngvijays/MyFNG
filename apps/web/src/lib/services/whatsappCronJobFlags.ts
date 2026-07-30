import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { WHATSAPP_CRON_JOBS } from '@/lib/whatsapp/cronSchedules';

export const WHATSAPP_CRON_JOB_ENABLED_SETTING_KEY = 'whatsapp_cron_job_enabled';

function parseMap(raw: unknown): Record<string, boolean> {
  if (!raw) return {};
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, boolean> = {};
    for (const [key, enabled] of Object.entries(value as Record<string, unknown>)) {
      out[key] = Boolean(enabled);
    }
    return out;
  } catch {
    return {};
  }
}

async function readMap(): Promise<Record<string, boolean>> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return {};
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', WHATSAPP_CRON_JOB_ENABLED_SETTING_KEY)
    .maybeSingle();
  return parseMap(data?.setting_value);
}

async function writeMap(
  map: Record<string, boolean>,
  updatedBy?: string | null,
): Promise<{ ok: true; map: Record<string, boolean> } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Database admin client unavailable' };

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: WHATSAPP_CRON_JOB_ENABLED_SETTING_KEY,
      setting_value: JSON.stringify(map),
      setting_type: 'JSON',
      category: 'NOTIFICATIONS',
      description: 'Per WhatsApp Cron job id on/off map. Missing keys default to true.',
      default_value: '{}',
      is_editable: true,
      updated_at: new Date().toISOString(),
      ...(updatedBy ? { updated_by: updatedBy } : {}),
    },
    { onConflict: 'setting_key' },
  );

  if (error) return { ok: false, error: error.message || 'Failed to save job flags' };
  return { ok: true, map };
}

/** Default ON when key missing. */
export async function isWhatsAppCronJobEnabled(jobId: string): Promise<boolean> {
  const map = await readMap();
  if (!(jobId in map)) return true;
  return Boolean(map[jobId]);
}

export async function getWhatsAppCronJobEnabledMap(): Promise<Record<string, boolean>> {
  const map = await readMap();
  const out: Record<string, boolean> = {};
  for (const job of WHATSAPP_CRON_JOBS) {
    out[job.id] = job.id in map ? Boolean(map[job.id]) : true;
  }
  return out;
}

export async function setWhatsAppCronJobEnabled(
  jobId: string,
  enabled: boolean,
  updatedBy?: string | null,
): Promise<{ ok: true; map: Record<string, boolean> } | { ok: false; error: string }> {
  if (!WHATSAPP_CRON_JOBS.some((j) => j.id === jobId)) {
    return { ok: false, error: 'Unknown jobId' };
  }
  const map = await readMap();
  map[jobId] = enabled;
  const saved = await writeMap(map, updatedBy);
  if (!saved.ok) return saved;
  return { ok: true, map: await getWhatsAppCronJobEnabledMap() };
}

/** Map API job= param → cron job id(s) that gate the run. */
export function cronJobIdsForAutomationParam(jobParam: string): string[] {
  const param = jobParam.trim().toLowerCase();
  if (param === 'all') {
    return WHATSAPP_CRON_JOBS.filter((j) => j.category === 'automation').map((j) => j.id);
  }
  const match = WHATSAPP_CRON_JOBS.find(
    (j) => j.category === 'automation' && j.jobParam === param,
  );
  return match ? [match.id] : [];
}
