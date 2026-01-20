import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const ENQUIRY_TABLE = 'enquiry_hub';
const ALLOCATOR_STATE_KEY = 'GLOBAL';

export type AllocationRow = {
  telecaller_id: string;
  allocation_percent: number;
  allocation_status: string | null;
  daily_limit: number | null;
};

type AllocatorState = {
  currentWeights?: Record<string, number>;
  lastPicked?: string | null;
};

export async function fetchActiveAllocations() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin not configured');

  const { data, error: qErr } = await supabaseAdmin
    .from(ENQUIRY_TABLE)
    .select('telecaller_id, allocation_percent, allocation_status, daily_limit')
    .eq('kind', 'ALLOCATION')
    .eq('is_active', true);

  if (qErr) throw new Error(qErr.message);
  const rows = (data as AllocationRow[]) || [];
  return rows.filter((r) => r.telecaller_id);
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchAssignedCountsToday(telecallerIds: string[]) {
  if (telecallerIds.length === 0) return new Map<string, number>();
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin not configured');

  const { data, error: qErr } = await supabaseAdmin
    .from(ENQUIRY_TABLE)
    .select('assigned_telecaller_id')
    .eq('kind', 'LEAD')
    .in('assigned_telecaller_id', telecallerIds)
    .gte('assigned_at', startOfTodayIso());

  if (qErr) throw new Error(qErr.message);
  const counts = new Map<string, number>();
  for (const row of (data as any[]) || []) {
    const id = String(row.assigned_telecaller_id || '');
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

async function readAllocatorState(): Promise<AllocatorState> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin not configured');

  const { data, error: qErr } = await supabaseAdmin
    .from(ENQUIRY_TABLE)
    .select('state')
    .eq('kind', 'ALLOCATOR_STATE')
    .eq('state_key', ALLOCATOR_STATE_KEY)
    .maybeSingle();

  if (qErr) throw new Error(qErr.message);
  return (data as any)?.state || {};
}

async function writeAllocatorState(state: AllocatorState) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin not configured');

  const payload = {
    kind: 'ALLOCATOR_STATE',
    state_key: ALLOCATOR_STATE_KEY,
    state,
    is_active: true,
  };

  const { error: upErr } = await supabaseAdmin
    .from(ENQUIRY_TABLE)
    .upsert(payload, { onConflict: 'state_key' });

  if (upErr) throw new Error(upErr.message);
}

function normalizeAllocations(rows: AllocationRow[]) {
  const active = rows.filter((r) => String(r.allocation_status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  const total = active.reduce((sum, r) => sum + Number(r.allocation_percent || 0), 0);
  return { active, total };
}

export async function pickTelecallerWeightedRoundRobin() {
  const rows = await fetchActiveAllocations();
  const { active, total } = normalizeAllocations(rows);
  if (active.length === 0) return { telecallerId: null, reason: 'no_active_allocations' };
  if (Math.abs(total - 100) > 0.001) return { telecallerId: null, reason: 'allocation_total_not_100', total };

  const telecallerIds = active.map((r) => String(r.telecaller_id));
  const counts = await fetchAssignedCountsToday(telecallerIds);

  const eligible = active.filter((r) => {
    const limit = r.daily_limit == null ? null : Number(r.daily_limit);
    if (!limit || limit <= 0) return true;
    const assigned = counts.get(String(r.telecaller_id)) || 0;
    return assigned < limit;
  });

  if (eligible.length === 0) return { telecallerId: null, reason: 'daily_limit_reached' };

  const totalEligibleWeight = eligible.reduce((sum, r) => sum + Number(r.allocation_percent || 0), 0);
  if (totalEligibleWeight <= 0) return { telecallerId: null, reason: 'no_eligible_weight' };

  const state = await readAllocatorState();
  const currentWeights = { ...(state.currentWeights || {}) } as Record<string, number>;

  let pickedId: string | null = null;
  let maxWeight = -Infinity;

  for (const row of eligible) {
    const id = String(row.telecaller_id);
    const weight = Number(row.allocation_percent || 0);
    const prev = Number(currentWeights[id] || 0);
    const next = prev + weight;
    currentWeights[id] = next;
    if (next > maxWeight) {
      maxWeight = next;
      pickedId = id;
    }
  }

  if (!pickedId) return { telecallerId: null, reason: 'no_pick' };
  currentWeights[pickedId] = currentWeights[pickedId] - totalEligibleWeight;

  await writeAllocatorState({ currentWeights, lastPicked: pickedId });
  return { telecallerId: pickedId, reason: null as null };
}

