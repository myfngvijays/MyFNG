import {
  STATUS_COMPONENTS,
  STATUS_LABEL,
  type ComponentKey,
  type IncidentImpact,
  type PublicStatus,
} from '@/lib/status/publicStatus';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const AUTO_INCIDENT_TITLE = 'Automatic health check';

type ProbeStatus = 'operational' | 'degraded' | 'major_outage';

const RANK: Record<PublicStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

let lastSyncAt = 0;
const MIN_SYNC_MS = 90_000;

function worst(a: PublicStatus, b: PublicStatus): PublicStatus {
  return RANK[b] > RANK[a] ? b : a;
}

function admin() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (error || !supabaseAdmin) return null;
  return supabaseAdmin as any;
}

function isMissingColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '');
  return error.code === '42703' || /column .* does not exist|source/i.test(msg);
}

export function probeHealthSummary(probes: Record<ComponentKey, ProbeStatus>): {
  overall: PublicStatus;
  affected: ComponentKey[];
} {
  let overall: PublicStatus = 'operational';
  const affected: ComponentKey[] = [];
  for (const component of STATUS_COMPONENTS) {
    const probe = probes[component.key];
    const status: PublicStatus =
      probe === 'major_outage' ? 'major_outage' : probe === 'degraded' ? 'degraded' : 'operational';
    if (status !== 'operational') affected.push(component.key);
    overall = worst(overall, status);
  }
  return { overall, affected };
}

function impactForOverall(overall: PublicStatus): IncidentImpact | null {
  if (overall === 'degraded') return 'degraded';
  if (overall === 'partial_outage') return 'partial_outage';
  if (overall === 'major_outage') return 'major_outage';
  return null;
}

function affectedLabel(keys: ComponentKey[]): string {
  const names = STATUS_COMPONENTS.filter((item) => keys.includes(item.key)).map((item) => item.name);
  if (!names.length) return 'One or more services';
  if (names.length <= 4) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
}

function sortKeys(keys: ComponentKey[]): string {
  return [...keys].sort().join(',');
}

async function fetchOpenAutoIncident(client: any) {
  const withSource = await client
    .from('status_incidents')
    .select('id, impact, component_keys, updated_at, state')
    .eq('source', 'auto')
    .neq('state', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!withSource.error) return withSource;
  if (!isMissingColumn(withSource.error)) return withSource;
  return client
    .from('status_incidents')
    .select('id, impact, component_keys, updated_at, state')
    .eq('title', AUTO_INCIDENT_TITLE)
    .neq('state', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function resolveAutoIncident(client: any, id: string) {
  const now = new Date().toISOString();
  const body =
    'Live checks are green again. Website, dashboards, and related services are responding normally. This entry was closed automatically.';
  await client.from('status_incident_updates').insert({
    incident_id: id,
    state: 'resolved',
    body,
    created_at: now,
  });
  await client
    .from('status_incidents')
    .update({ state: 'resolved', resolved_at: now, updated_at: now })
    .eq('id', id);
}

async function openAutoIncident(
  client: any,
  impact: IncidentImpact,
  affected: ComponentKey[],
  overall: PublicStatus,
) {
  const now = new Date().toISOString();
  const body = `Live checks reported ${STATUS_LABEL[overall].toLowerCase()} for: ${affectedLabel(affected)}. Staff may still be able to work after a refresh; this row is logged automatically when probes detect slowness or errors (for example 502 / slow login).`;
  const row: Record<string, unknown> = {
    title: AUTO_INCIDENT_TITLE,
    impact,
    component_keys: affected,
    state: 'investigating',
    created_at: now,
    updated_at: now,
    source: 'auto',
  };
  let insertRes = await client.from('status_incidents').insert(row).select('id').single();
  if (insertRes.error && isMissingColumn(insertRes.error)) {
    const { source: _source, ...withoutSource } = row;
    insertRes = await client.from('status_incidents').insert(withoutSource).select('id').single();
  }
  if (insertRes.error || !insertRes.data?.id) return;
  await client.from('status_incident_updates').insert({
    incident_id: insertRes.data.id,
    state: 'investigating',
    body,
    created_at: now,
  });
}

/**
 * Opens or resolves a single auto incident from raw probe results (not manual overlay).
 * Throttled on hot paths (/api/status); cron calls with force=true.
 */
export async function syncAutomatedStatusIncident(
  probes: Record<ComponentKey, ProbeStatus>,
  options?: { force?: boolean },
): Promise<{ synced: boolean; reason?: string }> {
  const client = admin();
  if (!client) return { synced: false, reason: 'no_admin' };

  if (!options?.force && Date.now() - lastSyncAt < MIN_SYNC_MS) {
    return { synced: false, reason: 'throttled' };
  }
  lastSyncAt = Date.now();

  const { overall, affected } = probeHealthSummary(probes);
  const impact = impactForOverall(overall);
  const openRes = await fetchOpenAutoIncident(client);
  if (openRes.error && !isMissingColumn(openRes.error)) {
    return { synced: false, reason: openRes.error.message };
  }
  const open = openRes.data as
    | { id: string; impact: string; component_keys: string[] | null; updated_at: string }
    | null
    | undefined;

  if (!impact) {
    if (open?.id) {
      await resolveAutoIncident(client, open.id);
      return { synced: true, reason: 'resolved' };
    }
    return { synced: false, reason: 'already_operational' };
  }

  if (!open?.id) {
    await openAutoIncident(client, impact, affected, overall);
    return { synced: true, reason: 'opened' };
  }

  const prevKeys = sortKeys((open.component_keys || []) as ComponentKey[]);
  const nextKeys = sortKeys(affected);
  const changed = prevKeys !== nextKeys || open.impact !== impact;
  const stale = Date.now() - +new Date(open.updated_at) > 5 * 60_000;
  if (changed && stale) {
    const now = new Date().toISOString();
    const body = `Still investigating. Current impact: ${STATUS_LABEL[overall].toLowerCase()}. Affected: ${affectedLabel(affected)}.`;
    await client.from('status_incident_updates').insert({
      incident_id: open.id,
      state: 'update',
      body,
      created_at: now,
    });
    await client
      .from('status_incidents')
      .update({ impact, component_keys: affected, updated_at: now })
      .eq('id', open.id);
    return { synced: true, reason: 'updated' };
  }

  return { synced: false, reason: 'unchanged' };
}