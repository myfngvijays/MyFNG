import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchAgentConfig } from './configStore';
import { getDispositionRulesConfig } from './dispositionRules';
import { processChaseAgentEvent } from '../chase/handler';
import { processFollowupAgentEvent } from '../followup/handler';
import { handleTelecrmDispositionEvent } from './telecrmDispositionHandler';
import {
  getActiveInstancesByPhone,
  normalizeAgentPhone,
  updateInstance,
} from './instanceService';
import { loadCrmSnapshot, loadMemory, saveMemory } from './memoryService';
import type { AgentInstance } from './types';

export type TelecrmRowSnapshot = {
  id?: string | null;
  mobile?: string | null;
  name?: string | null;
  city?: string | null;
  pincode?: string | null;
  disposition?: string | null;
  disposition_category?: string | null;
  disposition_note?: string | null;
  service_type?: string | null;
  vehicle_model?: string | null;
  updated_at?: string | null;
};

function crmFieldsFromRow(row: TelecrmRowSnapshot): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    city: row.city,
    pincode: row.pincode,
    disposition: row.disposition,
    disposition_category: row.disposition_category,
    disposition_note: row.disposition_note,
    service_type: row.service_type,
    vehicle_model: row.vehicle_model,
    updated_at: row.updated_at,
  };
}

function dispositionChanged(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  const prev = String(previous.disposition || '').trim().toLowerCase();
  const nextDisp = String(next.disposition || '').trim().toLowerCase();
  if (!nextDisp) return false;
  return prev !== nextDisp;
}

async function refreshInstanceCrmMemory(
  instance: AgentInstance,
  row: TelecrmRowSnapshot,
): Promise<Record<string, unknown>> {
  const memory = await loadMemory(instance.id);
  const freshCrm =
    (await loadCrmSnapshot(instance.telecrm_id || row.id || null)) ||
    crmFieldsFromRow(row);

  memory.crm_snapshot = {
    ...memory.crm_snapshot,
    ...freshCrm,
    ...crmFieldsFromRow(row),
  };
  await saveMemory(memory);

  if (row.id && !instance.telecrm_id) {
    await updateInstance(instance.id, { telecrm_id: row.id });
  }

  return memory.crm_snapshot;
}

async function processCrmUpdateForInstance(
  instance: AgentInstance,
  row: TelecrmRowSnapshot,
): Promise<boolean> {
  await refreshInstanceCrmMemory(instance, row);

  const chaseConfig = await fetchAgentConfig('CHASE');
  const { enabled: rulesEnabled } = getDispositionRulesConfig(chaseConfig);
  if (rulesEnabled && row.disposition) {
    const result = await handleTelecrmDispositionEvent({
      row,
      eventKind: 'disposition_change',
    });
    if (result.handled || result.skippedReason !== 'no_matching_disposition_rule') {
      return result.handled;
    }
  }

  if (instance.agent_type === 'CHASE') {
    const result = await processChaseAgentEvent({
      phone: instance.phone,
      eventType: 'CRM_UPDATE',
      telecrmId: instance.telecrm_id || row.id || null,
      instance,
      force: true,
    });
    return result.handled;
  }

  if (instance.agent_type === 'FOLLOWUP') {
    const result = await processFollowupAgentEvent({
      phone: instance.phone,
      eventType: 'CRM_UPDATE',
      instance,
      force: true,
    });
    return result.handled;
  }

  return false;
}

/**
 * Re-run CHASE/FOLLOWUP agents when TeleCRM disposition changes for an active instance.
 */
export async function triggerCrmUpdateForTelecrmRow(
  row: TelecrmRowSnapshot,
): Promise<{ processed: number; instanceIds: string[] }> {
  const phone = normalizeAgentPhone(row.mobile || '');
  if (!phone) return { processed: 0, instanceIds: [] };

  const instances = await getActiveInstancesByPhone(phone, ['CHASE', 'FOLLOWUP']);
  if (!instances.length) return { processed: 0, instanceIds: [] };

  const crm = crmFieldsFromRow(row);
  const instanceIds: string[] = [];

  for (const instance of instances) {
    const memory = await loadMemory(instance.id);
    if (!dispositionChanged(memory.crm_snapshot || {}, crm)) continue;

    const handled = await processCrmUpdateForInstance(instance, row);
    if (handled) instanceIds.push(instance.id);
  }

  return { processed: instanceIds.length, instanceIds };
}

export function triggerCrmUpdateForTelecrmRowSafe(row: TelecrmRowSnapshot): void {
  Promise.resolve()
    .then(() => triggerCrmUpdateForTelecrmRow(row))
    .catch((err) => {
      console.error('[crm-update-trigger] failed:', err?.message || err);
    });
}

/**
 * Cron poll: detect telecrm_api disposition changes for active agent instances.
 */
export async function pollCrmUpdatesForActiveInstances(
  lookbackMinutes = 15,
): Promise<{ checked: number; processed: number; errors: string[] }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { checked: 0, processed: 0, errors: ['No admin client'] };

  const since = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  const errors: string[] = [];
  let processed = 0;

  const { data: instances, error: instError } = await supabaseAdmin
    .from('whatsapp_agent_instances')
    .select('id, phone, agent_type, telecrm_id, status, metadata')
    .in('agent_type', ['CHASE', 'FOLLOWUP'])
    .in('status', ['ACTIVE', 'WAITING'])
    .limit(100);

  if (instError) {
    return { checked: 0, processed: 0, errors: [instError.message] };
  }

  const rows = (instances || []) as AgentInstance[];
  let checked = 0;

  for (const instance of rows) {
    checked += 1;
    try {
      let telecrmRow: TelecrmRowSnapshot | null = null;

      if (instance.telecrm_id) {
        const { data } = await supabaseAdmin
          .from('telecrm_api')
          .select(
            'id, mobile, name, city, pincode, disposition, disposition_category, disposition_note, service_type, vehicle_model, updated_at',
          )
          .eq('id', instance.telecrm_id)
          .gte('updated_at', since)
          .maybeSingle();
        telecrmRow = (data as TelecrmRowSnapshot) || null;
      }

      if (!telecrmRow) {
        const { data } = await supabaseAdmin
          .from('telecrm_api')
          .select(
            'id, mobile, name, city, pincode, disposition, disposition_category, disposition_note, service_type, vehicle_model, updated_at',
          )
          .eq('mobile', instance.phone)
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        telecrmRow = (data as TelecrmRowSnapshot) || null;
      }

      if (!telecrmRow?.disposition) continue;

      const memory = await loadMemory(instance.id);
      if (!dispositionChanged(memory.crm_snapshot || {}, crmFieldsFromRow(telecrmRow))) continue;

      const handled = await processCrmUpdateForInstance(instance, telecrmRow);
      if (handled) processed += 1;
    } catch (err: any) {
      errors.push(`${instance.id}: ${err?.message || 'unknown'}`);
    }
  }

  return { checked, processed, errors };
}
