import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pushTelecrmRow, type TelecrmRow } from '@/lib/telecrm/push';
import type { AgentConfig } from './types';

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin client unavailable');
  return supabaseAdmin;
}

export async function updateTelecrmFromAgent(input: {
  telecrmId: string | null;
  phone: string;
  crmFields: Record<string, string>;
  config: AgentConfig;
  action: 'on_booking' | 'on_escalation' | 'on_end_max_attempts' | 'custom';
}): Promise<void> {
  const db = getAdminDb();
  const phone10 = input.phone.replace(/\D/g, '').slice(-10);

  let row: TelecrmRow | null = null;

  if (input.telecrmId) {
    const { data } = await db
      .from('telecrm_api')
      .select('*')
      .eq('id', input.telecrmId)
      .maybeSingle();
    row = (data as TelecrmRow) || null;
  }

  if (!row && phone10) {
    const { data } = await db
      .from('telecrm_api')
      .select('*')
      .eq('mobile', phone10)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as TelecrmRow) || null;
  }

  if (!row) return;

  const syncKey =
    input.action === 'custom'
      ? null
      : input.config.telecrm_sync_json[input.action];

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.crmFields.disposition || syncKey?.disposition) {
    patch.disposition = input.crmFields.disposition || syncKey?.disposition;
  }
  if (input.crmFields.disposition_category || syncKey?.disposition_category) {
    patch.disposition_category =
      input.crmFields.disposition_category || syncKey?.disposition_category;
  }
  if (input.crmFields.disposition_note) {
    patch.disposition_note = input.crmFields.disposition_note;
  }
  if (input.crmFields.name) patch.name = input.crmFields.name;
  if (input.crmFields.service_type) patch.service_type = input.crmFields.service_type;
  if (input.crmFields.vehicle_model) patch.vehicle_model = input.crmFields.vehicle_model;

  await db.from('telecrm_api').update(patch).eq('id', row.id);

  const { data: updated } = await db.from('telecrm_api').select('*').eq('id', row.id).single();
  if (updated) {
    await pushTelecrmRow(db, updated as TelecrmRow, 'whatsapp-chase-agent');
  }
}
