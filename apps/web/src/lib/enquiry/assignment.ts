import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  normalizeAllowedChannels,
  telecallerAllowsChannel,
  type LeadDistributionChannelId,
} from '@/lib/enquiry/leadChannels';
import {
  filterAllocationsForLeadPincode,
  normalizeAllowedPincodes,
  normalizePincodeMode,
  type PincodeRoutingMode,
} from '@/lib/enquiry/pincodeAllocation';
import {
  findMatchingMessageTrigger,
  normalizeMessageTriggers,
  type MessageTrigger,
} from '@/lib/enquiry/messageTriggers';
import { getClickToCallConfig } from '@/lib/telecaller/clickToCallConfig';
import {
  getAssignmentAvailability,
  resolveAvailableCoverId,
} from '@/lib/telecaller/clickToCallHours';

const ENQUIRY_TABLE = 'enquiry_hub';
const ALLOCATOR_STATE_KEY = 'GLOBAL';

export type AllocationRow = {
  telecaller_id: string;
  allocation_percent: number;
  allocation_status: string | null;
  daily_limit: number | null;
  meta?: Record<string, unknown> | null;
  allowed_channels?: LeadDistributionChannelId[] | null;
  allowed_pincodes?: string[] | null;
  pincode_mode?: PincodeRoutingMode | null;
};

type AllocatorState = {
  currentWeights?: Record<string, number>;
  lastPicked?: string | null;
  message_triggers?: MessageTrigger[];
};

export async function fetchActiveAllocations(): Promise<AllocationRow[]> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin not configured');

  const { data, error: qErr } = await supabaseAdmin
    .from(ENQUIRY_TABLE)
    .select('telecaller_id, allocation_percent, allocation_status, daily_limit, meta')
    .eq('kind', 'ALLOCATION')
    .eq('is_active', true);

  if (qErr) throw new Error(qErr.message);
  const rows = (data as any[]) || [];
  return rows
    .filter((r) => r.telecaller_id)
    .map((r) => ({
      telecaller_id: String(r.telecaller_id),
      allocation_percent: Number(r.allocation_percent || 0),
      allocation_status: r.allocation_status || null,
      daily_limit: r.daily_limit == null ? null : Number(r.daily_limit),
      meta: r.meta && typeof r.meta === 'object' ? r.meta : {},
      allowed_channels: normalizeAllowedChannels(
        r.meta && typeof r.meta === 'object' ? (r.meta as any).allowed_channels : null,
      ),
      allowed_pincodes: normalizeAllowedPincodes(
        r.meta && typeof r.meta === 'object' ? (r.meta as any).allowed_pincodes : null,
      ),
      pincode_mode: normalizePincodeMode(
        r.meta && typeof r.meta === 'object' ? (r.meta as any).pincode_mode : null,
        normalizeAllowedPincodes(
          r.meta && typeof r.meta === 'object' ? (r.meta as any).allowed_pincodes : null,
        ),
      ),
    }));
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

  const counts = new Map<string, number>();
  const bump = (id: string) => {
    if (!id) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  };

  const since = startOfTodayIso();

  const { data: enquiryRows, error: qErr } = await supabaseAdmin
    .from(ENQUIRY_TABLE)
    .select('assigned_telecaller_id')
    .eq('kind', 'LEAD')
    .in('assigned_telecaller_id', telecallerIds)
    .gte('assigned_at', since);

  if (qErr) throw new Error(qErr.message);
  for (const row of (enquiryRows as any[]) || []) {
    bump(String(row.assigned_telecaller_id || ''));
  }

  try {
    const { data: serviceRows } = await supabaseAdmin
      .from('service_leads')
      .select('assigned_telecaller_id')
      .in('assigned_telecaller_id', telecallerIds)
      .gte('assigned_at', since)
      .is('deleted_at', null);
    for (const row of (serviceRows as any[]) || []) {
      bump(String(row.assigned_telecaller_id || ''));
    }
  } catch {
    /* older schemas */
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

async function writeAllocatorState(patch: Partial<AllocatorState>) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin not configured');

  const prev = await readAllocatorState();
  const state: AllocatorState = {
    ...prev,
    ...patch,
  };

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from(ENQUIRY_TABLE)
    .select('id')
    .eq('kind', 'ALLOCATOR_STATE')
    .eq('state_key', ALLOCATOR_STATE_KEY)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  if (existing?.id) {
    const { error: updateErr } = await supabaseAdmin
      .from(ENQUIRY_TABLE)
      .update({ state, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updateErr) throw new Error(updateErr.message);
  } else {
    const payload = {
      kind: 'ALLOCATOR_STATE',
      state_key: ALLOCATOR_STATE_KEY,
      state,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabaseAdmin.from(ENQUIRY_TABLE).insert(payload);

    if (insertErr) throw new Error(insertErr.message);
  }
}

export async function fetchMessageTriggers(): Promise<MessageTrigger[]> {
  const state = await readAllocatorState();
  return normalizeMessageTriggers(state.message_triggers);
}

export async function saveMessageTriggers(triggers: MessageTrigger[]): Promise<void> {
  await writeAllocatorState({
    message_triggers: normalizeMessageTriggers(triggers),
  });
}

function normalizeAllocations(rows: AllocationRow[]) {
  const active = rows.filter((r) => String(r.allocation_status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  const total = active.reduce((sum, r) => sum + Number(r.allocation_percent || 0), 0);
  return { active, total };
}

export type PickTelecallerResult = {
  telecallerId: string | null;
  reason: string | null;
  channel?: string | null;
  total?: number;
  trigger?: MessageTrigger | null;
  assignment_mode?: 'MESSAGE_TRIGGER' | 'WEIGHTED_RR';
};

/**
 * Weighted round-robin pick.
 * @param channel — optional lead channel; telecallers with a restricted allowlist are skipped if channel not allowed.
 */
export async function pickTelecallerWeightedRoundRobin(
  channel?: string | null,
  pincode?: string | null,
): Promise<PickTelecallerResult> {
  const rows = await fetchActiveAllocations();
  const { active, total } = normalizeAllocations(rows);
  if (active.length === 0) return { telecallerId: null, reason: 'no_active_allocations' };
  if (Math.abs(total - 100) > 0.001) {
    return { telecallerId: null, reason: 'allocation_total_not_100', total };
  }

  const pincodeFiltered = filterAllocationsForLeadPincode(active, pincode);
  if (pincodeFiltered.length === 0) {
    return { telecallerId: null, reason: 'no_telecaller_for_pincode', channel: channel || null };
  }

  const channelFiltered = pincodeFiltered.filter((r) =>
    telecallerAllowsChannel(r.allowed_channels, channel || null),
  );
  if (channelFiltered.length === 0) {
    return { telecallerId: null, reason: 'no_telecaller_for_channel', channel: channel || null };
  }

  let hoursCfg: Awaited<ReturnType<typeof getClickToCallConfig>> | null = null;
  try {
    hoursCfg = await getClickToCallConfig();
  } catch {
    hoursCfg = null;
  }

  const rosterFiltered: AllocationRow[] = [];
  if (hoursCfg) {
    for (const row of channelFiltered) {
      const id = String(row.telecaller_id);
      const avail = getAssignmentAvailability(hoursCfg, id);
      if (avail.available) {
        const existing = rosterFiltered.find((r) => r.telecaller_id === id);
        if (existing) {
          existing.allocation_percent += Number(row.allocation_percent || 0);
        } else {
          rosterFiltered.push({ ...row });
        }
        continue;
      }
      const coverId = resolveAvailableCoverId(hoursCfg, id);
      if (!coverId || coverId === id) continue;
      const existing = rosterFiltered.find((r) => r.telecaller_id === coverId);
      if (existing) {
        existing.allocation_percent += Number(row.allocation_percent || 0);
      } else {
        rosterFiltered.push({ ...row, telecaller_id: coverId });
      }
    }
  }

  const pool = hoursCfg ? rosterFiltered : channelFiltered;
  if (pool.length === 0) {
    return { telecallerId: null, reason: 'no_telecaller_on_duty', channel: channel || null };
  }

  const telecallerIds = pool.map((r) => String(r.telecaller_id));
  const counts = await fetchAssignedCountsToday(telecallerIds);

  const eligible = pool.filter((r) => {
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
  return {
    telecallerId: pickedId,
    reason: null,
    assignment_mode: 'WEIGHTED_RR',
    channel: channel || null,
  };
}

/**
 * Advanced pick: Message Trigger (Meta prefill) first, then channel % allocation.
 */
export async function pickTelecallerForLead(opts?: {
  channel?: string | null;
  messageText?: string | null;
  pincode?: string | null;
}): Promise<PickTelecallerResult> {
  const channel = opts?.channel || null;
  const messageText = opts?.messageText || null;
  const pincode = opts?.pincode || null;

  if (messageText) {
    const triggers = await fetchMessageTriggers();
    const matched = findMatchingMessageTrigger(messageText, triggers);
    if (matched) {
      let telecallerId = matched.telecaller_id;
      try {
        const hoursCfg = await getClickToCallConfig();
        const avail = getAssignmentAvailability(hoursCfg, telecallerId);
        if (!avail.available) {
          telecallerId = resolveAvailableCoverId(hoursCfg, telecallerId) || telecallerId;
        }
      } catch {
        /* keep trigger owner */
      }
      return {
        telecallerId,
        reason: null,
        trigger: matched,
        assignment_mode: 'MESSAGE_TRIGGER',
        channel: matched.mark_as_meta ? 'WHATSAPP_META' : channel,
      };
    }
  }

  return pickTelecallerWeightedRoundRobin(channel, pincode);
}
