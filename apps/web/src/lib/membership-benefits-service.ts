import {
  buildCustomerLeadOrFilter,
  filterLeadsForCustomer,
  normalizeCustomerPhone,
} from '@/lib/customer-service-leads';
import { pushServiceLeadToTeleCRM } from '@/lib/booking-telecrm-sync';

export const COMPLETED_SERVICE_LEAD_STATUSES = [
  'COMPLETED',
  'DELIVERED',
  'DELIVERED_TO_CUSTOMER',
  'CLOSED',
  'PAID',
  'DONE',
  'COMPLETE',
] as const;

export const MEMBERSHIP_CLAIMS_UNLOCK_MESSAGE =
  'Benefit claims unlock after your first service is completed.';

export const MEMBERSHIP_CLAIMS_HIDDEN_MESSAGE =
  'Membership benefit claims are hidden for this account.';

export type ClaimsButtonOverride = 'AUTO' | 'SHOW' | 'HIDE';

export function parseClaimsButtonOverride(value: unknown): ClaimsButtonOverride {
  const raw = String(value || '')
    .trim()
    .toUpperCase();
  if (raw === 'SHOW' || raw === 'HIDE') return raw;
  return 'AUTO';
}

async function resolveClaimsButtonOverride(
  supabaseAdmin: any,
  membership: { claims_button_override?: unknown; customer_id?: string },
  customerId: string,
): Promise<ClaimsButtonOverride> {
  const fromMembership = parseClaimsButtonOverride(membership.claims_button_override);
  if (fromMembership !== 'AUTO') return fromMembership;
  const { data: profile } = await supabaseAdmin
    .from('customer_profiles')
    .select('preferences')
    .eq('customer_id', customerId)
    .maybeSingle();
  const prefs =
    profile?.preferences && typeof profile.preferences === 'object'
      ? (profile.preferences as Record<string, unknown>)
      : {};
  return parseClaimsButtonOverride(prefs.membership_claims_button);
}

export const DEFAULT_BENEFIT_MAX_USAGE: Record<string, number | null> = {
  PERIODIC_10_OFF: null,
  FREE_INSPECTION: 2,
  FREE_SCAN: 2,
  DAMAGE_ASSESS: 1,
};

export type MembershipClaimMeta = {
  benefit_code: string;
  benefit_title: string;
  vehicle_number?: string | null;
  vehicle_label?: string | null;
};

export type MembershipBenefitStatus = {
  benefit_code: string;
  title: string;
  max_usage: number | null;
  used_count: number;
  remaining: number | null;
  pending_count: number;
  approval_pending: boolean;
  show_claim_button: boolean;
  claimable: boolean;
};

export type MembershipClaimHistoryItem = {
  id: string;
  benefit_code: string;
  benefit_title: string;
  vehicle_number: string | null;
  vehicle_label: string | null;
  created_at: string;
  reviewed_at?: string | null;
  claim_status?: string | null;
  reference_type: string | null;
  reference_id: string | null;
  lead_number: string | null;
  lead_status: string | null;
};

function normalizePlate(input: unknown): string {
  return String(input || '').replace(/\s+/g, '').toUpperCase();
}

function resolveMaxUsage(benefit: any): number | null {
  if (benefit?.max_usage != null && Number.isFinite(Number(benefit.max_usage))) {
    return Number(benefit.max_usage);
  }
  const code = String(benefit?.benefit_code || '').toUpperCase();
  return DEFAULT_BENEFIT_MAX_USAGE[code] ?? null;
}

export async function getActiveCustomerMembership(supabaseAdmin: any, customerId: string) {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from('customer_memberships')
    .select('*, plan:membership_plans(*)')
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE')
    .gt('ends_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

function membershipVehiclePlates(membership: any): Set<string> {
  const plates = new Set<string>();
  const primary = membership?.primary_vehicle_snapshot;
  const second = membership?.second_vehicle_snapshot;
  if (primary?.vehicle_number) plates.add(normalizePlate(primary.vehicle_number));
  if (second?.vehicle_number) plates.add(normalizePlate(second.vehicle_number));
  return plates;
}

function isCompletedServiceLeadStatus(status: unknown): boolean {
  const normalized = String(status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return false;
  return (COMPLETED_SERVICE_LEAD_STATUSES as readonly string[]).includes(normalized);
}

function resolveLeadCompletionMs(lead: {
  completed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}): number {
  for (const value of [lead.completed_at, lead.updated_at, lead.created_at]) {
    const ms = new Date(String(value || '')).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return 0;
}

function isQualifyingMembershipUnlockLead(
  lead: { meta?: unknown; status?: unknown; completed_at?: string | null; updated_at?: string | null; created_at?: string | null },
  membershipStartMs: number,
): boolean {
  if (!isCompletedServiceLeadStatus(lead.status)) return false;
  if (isMembershipClaimLead(lead)) return false;
  const doneAtMs = resolveLeadCompletionMs(lead);
  if (!Number.isFinite(doneAtMs) || doneAtMs <= 0) return false;
  return doneAtMs >= membershipStartMs - 60_000;
}

async function findQualifyingCompletedServiceLead(
  supabaseAdmin: any,
  customer: { id: string; phone?: string | null },
  membership: { starts_at?: string | null; created_at?: string | null },
): Promise<boolean> {
  const normalizedPhone = normalizeCustomerPhone(customer.phone);
  if (!normalizedPhone) return false;

  const membershipStartMs = new Date(membership.starts_at || membership.created_at || 0).getTime();
  const { data: leads } = await supabaseAdmin
    .from('service_leads')
    .select('id, status, meta, created_at, completed_at, updated_at, customer_phone')
    .or(buildCustomerLeadOrFilter({ id: customer.id, phone: normalizedPhone }))
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(100);

  return filterLeadsForCustomer(leads, { id: customer.id, phone: normalizedPhone }).some((lead) =>
    isQualifyingMembershipUnlockLead(lead, membershipStartMs),
  );
}

export function isMembershipClaimLead(lead: { meta?: unknown; lead_source?: string | null } | null | undefined): boolean {
  if (lead?.lead_source && /membership claim/i.test(String(lead.lead_source))) return true;
  if (!lead?.meta || typeof lead.meta !== 'object') return false;
  return Boolean((lead.meta as { membership_claim?: { benefit_code?: string } }).membership_claim?.benefit_code);
}

export function isVoidedMembershipUsageLead(lead: {
  deleted_at?: unknown;
  status?: unknown;
} | null | undefined): boolean {
  if (!lead) return true;
  if (lead.deleted_at) return true;
  const status = String(lead.status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return status === 'CANCELLED' || status === 'CANCELED';
}

export function usageCountsTowardBenefitQuota(
  row: { reference_type?: unknown; reference_id?: unknown },
  leadById: Record<string, { deleted_at?: unknown; status?: unknown }>,
): boolean {
  if (String(row.reference_type || '').toUpperCase() !== 'LEAD' || !row.reference_id) {
    return true;
  }
  const lead = leadById[String(row.reference_id)];
  if (!lead) return true;
  return !isVoidedMembershipUsageLead(lead);
}

export async function areMembershipClaimsUnlocked(
  supabaseAdmin: any,
  customer: { id: string; phone?: string | null },
  membership: {
    id?: string;
    customer_id?: string;
    starts_at?: string | null;
    created_at?: string | null;
    source_lead_id?: string | null;
    claims_button_override?: unknown;
  },
): Promise<{ unlocked: boolean; pendingLeadId?: string | null; hiddenByAdmin?: boolean }> {
  const customerId = String(customer.id || membership.customer_id || '');
  const override = customerId
    ? await resolveClaimsButtonOverride(supabaseAdmin, membership, customerId)
    : parseClaimsButtonOverride(membership.claims_button_override);
  if (override === 'SHOW') return { unlocked: true };
  if (override === 'HIDE') {
    return {
      unlocked: false,
      pendingLeadId: membership?.source_lead_id || null,
      hiddenByAdmin: true,
    };
  }
  const sourceLeadId = membership?.source_lead_id ? String(membership.source_lead_id) : null;

  if (sourceLeadId) {
    const { data: lead } = await supabaseAdmin
      .from('service_leads')
      .select('id, status, meta, completed_at, updated_at, created_at')
      .eq('id', sourceLeadId)
      .maybeSingle();

    const membershipStartMs = new Date(membership.starts_at || membership.created_at || 0).getTime();
    if (lead && isQualifyingMembershipUnlockLead(lead, membershipStartMs)) {
      return { unlocked: true };
    }
  }

  const unlocked = await findQualifyingCompletedServiceLead(supabaseAdmin, customer, membership);
  if (unlocked) return { unlocked: true };

  return { unlocked: false, pendingLeadId: sourceLeadId || null };
}

export type MembershipClaimRequestRow = {
  id: string;
  benefit_code: string;
  benefit_title: string;
  status: string;
  vehicle_number: string | null;
  vehicle_label: string | null;
  created_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
};

export async function getMembershipBenefitsStatus(
  supabaseAdmin: any,
  customerId: string,
  customerPhone?: string | null,
): Promise<{
  benefits: MembershipBenefitStatus[];
  history: MembershipClaimHistoryItem[];
  pending_requests: MembershipClaimRequestRow[];
  claims_unlocked: boolean;
  claims_unlock_message: string | null;
}> {
  const membership = await getActiveCustomerMembership(supabaseAdmin, customerId);
  if (!membership) {
    return {
      benefits: [],
      history: [],
      pending_requests: [],
      claims_unlocked: false,
      claims_unlock_message: null,
    };
  }
  return getMembershipBenefitsStatusForMembership(supabaseAdmin, membership, customerPhone);
}

export async function getMembershipBenefitsStatusForMembership(
  supabaseAdmin: any,
  membership: {
    id: string;
    customer_id: string;
    plan_id: string;
    starts_at?: string | null;
    created_at?: string | null;
    source_lead_id?: string | null;
    claims_button_override?: unknown;
  },
  customerPhone?: string | null,
): Promise<{
  benefits: MembershipBenefitStatus[];
  history: MembershipClaimHistoryItem[];
  pending_requests: MembershipClaimRequestRow[];
  claims_unlocked: boolean;
  claims_unlock_message: string | null;
}> {
  const customerId = String(membership.customer_id);
  const { fetchPendingMembershipClaimRequests } = await import('@/lib/membership-claim-approval');
  const pendingRequests = await fetchPendingMembershipClaimRequests(supabaseAdmin, String(membership.id));
  const pendingByCode: Record<string, number> = {};
  for (const row of pendingRequests) {
    const code = String(row.benefit_code || '').toUpperCase();
    pendingByCode[code] = (pendingByCode[code] || 0) + 1;
  }

  const unlockState = await areMembershipClaimsUnlocked(
    supabaseAdmin,
    { id: customerId, phone: customerPhone },
    membership,
  );
  const claimsUnlocked = unlockState.unlocked;
  const { data: planBenefits } = await supabaseAdmin
    .from('membership_benefits')
    .select('benefit_code, title, max_usage, display_order, active, show_claim_button')
    .eq('plan_id', membership.plan_id)
    .eq('active', true)
    .order('display_order', { ascending: true });

  const { data: usageRows } = await supabaseAdmin
    .from('membership_usage')
    .select('id, benefit_code, reference_type, reference_id, created_at')
    .eq('customer_id', customerId)
    .eq('customer_membership_id', membership.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const usageLeadIds = (usageRows || [])
    .filter((r: any) => String(r.reference_type || '').toUpperCase() === 'LEAD' && r.reference_id)
    .map((r: any) => String(r.reference_id));
  const usageLeadById: Record<string, { deleted_at?: unknown; status?: unknown }> = {};
  if (usageLeadIds.length > 0) {
    const { data: usageLeads } = await supabaseAdmin
      .from('service_leads')
      .select('id, status, deleted_at')
      .in('id', usageLeadIds);
    for (const lead of usageLeads || []) {
      usageLeadById[String(lead.id)] = lead;
    }
  }

  const usageByCode: Record<string, number> = {};
  for (const row of usageRows || []) {
    if (!usageCountsTowardBenefitQuota(row, usageLeadById)) continue;
    const code = String(row.benefit_code || '').toUpperCase();
    usageByCode[code] = (usageByCode[code] || 0) + 1;
  }

  const titleByCode: Record<string, string> = {};
  for (const b of planBenefits || []) {
    titleByCode[String(b.benefit_code || '').toUpperCase()] = String(b.title || b.benefit_code || '');
  }

  const benefits: MembershipBenefitStatus[] = (planBenefits || [])
    .filter((b: any) => b.show_claim_button === true)
    .map((b: any) => {
      const code = String(b.benefit_code || '').toUpperCase();
      const maxUsage = resolveMaxUsage(b);
      const usedCount = usageByCode[code] || 0;
      const pendingCount = pendingByCode[code] || 0;
      const reservedCount = usedCount + pendingCount;
      const remaining = maxUsage == null ? null : Math.max(0, maxUsage - reservedCount);
      const hasQuotaLeft = maxUsage == null ? true : reservedCount < maxUsage;
      const approvalPending = pendingCount > 0;
      return {
        benefit_code: code,
        title: String(b.title || code),
        max_usage: maxUsage,
        used_count: usedCount,
        remaining,
        pending_count: pendingCount,
        approval_pending: approvalPending,
        show_claim_button: claimsUnlocked,
        claimable: claimsUnlocked && hasQuotaLeft && !approvalPending,
      };
    });

  const leadIds = (usageRows || [])
    .filter((r: any) => String(r.reference_type || '').toUpperCase() === 'LEAD' && r.reference_id)
    .map((r: any) => String(r.reference_id));

  const { data: claimRequestRows } = await supabaseAdmin
    .from('membership_claim_requests')
    .select(
      'id, benefit_code, benefit_title, status, vehicle_number, vehicle_label, created_at, reviewed_at, lead_id, membership_usage_id',
    )
    .eq('customer_membership_id', membership.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const claimLeadIds = (claimRequestRows || [])
    .map((row: any) => String(row.lead_id || '').trim())
    .filter(Boolean);
  const historyLeadIds = Array.from(new Set([...leadIds, ...claimLeadIds]));

  const leadById: Record<string, any> = {};
  if (historyLeadIds.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, status, vehicle_number, vehicle_make, vehicle_model, meta')
      .in('id', historyLeadIds);
    for (const lead of leads || []) {
      leadById[String(lead.id)] = lead;
    }
  }

  const linkedUsageIds = new Set(
    (claimRequestRows || [])
      .map((row: any) => String(row.membership_usage_id || '').trim())
      .filter(Boolean),
  );

  const requestHistory: MembershipClaimHistoryItem[] = (claimRequestRows || []).map((row: any) => {
    const code = String(row.benefit_code || '').toUpperCase();
    const lead = row.lead_id ? leadById[String(row.lead_id)] : null;
    const claimMeta = (lead?.meta as any)?.membership_claim || {};
    const vehicleLabel =
      row.vehicle_label ||
      claimMeta.vehicle_label ||
      [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ') ||
      null;
    return {
      id: String(row.id),
      benefit_code: code,
      benefit_title: String(row.benefit_title || titleByCode[code] || code),
      vehicle_number: row.vehicle_number || claimMeta.vehicle_number || lead?.vehicle_number || null,
      vehicle_label: vehicleLabel,
      created_at: String(row.created_at || ''),
      reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
      claim_status: String(row.status || 'PENDING').toUpperCase(),
      reference_type: row.lead_id ? 'LEAD' : null,
      reference_id: row.lead_id ? String(row.lead_id) : null,
      lead_number: lead?.lead_number || null,
      lead_status: lead?.status || null,
    };
  });

  const legacyHistory: MembershipClaimHistoryItem[] = (usageRows || [])
    .filter((row: any) => !linkedUsageIds.has(String(row.id)))
    .filter((row: any) => usageCountsTowardBenefitQuota(row, usageLeadById))
    .map((r: any) => {
      const code = String(r.benefit_code || '').toUpperCase();
      const lead = r.reference_id ? leadById[String(r.reference_id)] : null;
      const claimMeta = (lead?.meta as any)?.membership_claim || {};
      const vehicleLabel =
        claimMeta.vehicle_label ||
        [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ') ||
        null;
      return {
        id: String(r.id),
        benefit_code: code,
        benefit_title: String(claimMeta.benefit_title || titleByCode[code] || code),
        vehicle_number: claimMeta.vehicle_number || lead?.vehicle_number || null,
        vehicle_label: vehicleLabel,
        created_at: String(r.created_at || ''),
        reviewed_at: String(r.created_at || ''),
        claim_status: 'APPROVED',
        reference_type: r.reference_type || null,
        reference_id: r.reference_id || null,
        lead_number: lead?.lead_number || null,
        lead_status: lead?.status || null,
      };
    });

  const history = [...requestHistory, ...legacyHistory].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return {
    benefits,
    history,
    pending_requests: pendingRequests,
    claims_unlocked: claimsUnlocked,
    claims_unlock_message: claimsUnlocked
      ? null
      : unlockState.hiddenByAdmin
        ? MEMBERSHIP_CLAIMS_HIDDEN_MESSAGE
        : MEMBERSHIP_CLAIMS_UNLOCK_MESSAGE,
  };
}

export async function validateMembershipClaim(
  supabaseAdmin: any,
  customerId: string,
  benefitCodeInput: string,
  vehicleNumberInput?: string | null,
  allowedPlatesOverride?: Set<string>,
  opts?: { ignorePendingRequestId?: string | null },
): Promise<
  | {
      valid: true;
      membership: any;
      benefit: any;
      benefitCode: string;
      benefitTitle: string;
      maxUsage: number | null;
      usedCount: number;
    }
  | { valid: false; error: string }
> {
  const benefitCode = String(benefitCodeInput || '').toUpperCase();
  if (!benefitCode) {
    return { valid: false, error: 'Benefit code is required.' };
  }

  const membership = await getActiveCustomerMembership(supabaseAdmin, customerId);
  if (!membership) {
    return { valid: false, error: 'Active membership required to claim this benefit.' };
  }

  const { data: customerRow } = await supabaseAdmin
    .from('customers')
    .select('phone')
    .eq('id', customerId)
    .maybeSingle();
  const unlockState = await areMembershipClaimsUnlocked(
    supabaseAdmin,
    { id: customerId, phone: customerRow?.phone },
    membership,
  );
  if (!unlockState.unlocked) {
    return {
      valid: false,
      error: unlockState.hiddenByAdmin
        ? MEMBERSHIP_CLAIMS_HIDDEN_MESSAGE
        : MEMBERSHIP_CLAIMS_UNLOCK_MESSAGE,
    };
  }

  const { data: benefit } = await supabaseAdmin
    .from('membership_benefits')
    .select('*')
    .eq('plan_id', membership.plan_id)
    .eq('benefit_code', benefitCode)
    .eq('active', true)
    .maybeSingle();

  if (!benefit) {
    return { valid: false, error: 'Benefit not available on your membership plan.' };
  }

  if (benefit.show_claim_button !== true) {
    return { valid: false, error: 'Claim is not enabled for this benefit.' };
  }

  const { data: usageForBenefit } = await supabaseAdmin
    .from('membership_usage')
    .select('id, reference_type, reference_id')
    .eq('customer_membership_id', membership.id)
    .eq('benefit_code', benefitCode);

  const usageLeadIds = (usageForBenefit || [])
    .filter((r: any) => String(r.reference_type || '').toUpperCase() === 'LEAD' && r.reference_id)
    .map((r: any) => String(r.reference_id));
  const usageLeadById: Record<string, { deleted_at?: unknown; status?: unknown }> = {};
  if (usageLeadIds.length > 0) {
    const { data: usageLeads } = await supabaseAdmin
      .from('service_leads')
      .select('id, status, deleted_at')
      .in('id', usageLeadIds);
    for (const lead of usageLeads || []) {
      usageLeadById[String(lead.id)] = lead;
    }
  }
  const usedCount = (usageForBenefit || []).filter((row: any) =>
    usageCountsTowardBenefitQuota(row, usageLeadById),
  ).length;
  const maxUsage = resolveMaxUsage(benefit);

  let pendingQuery = supabaseAdmin
    .from('membership_claim_requests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_membership_id', membership.id)
    .eq('benefit_code', benefitCode)
    .eq('status', 'PENDING');

  const ignorePendingRequestId = String(opts?.ignorePendingRequestId || '').trim();
  if (ignorePendingRequestId) {
    pendingQuery = pendingQuery.neq('id', ignorePendingRequestId);
  }

  const { count: pendingCountRaw } = await pendingQuery;
  const pendingCount = Number(pendingCountRaw || 0);

  if (pendingCount > 0) {
    return {
      valid: false,
      error: 'This benefit already has a pending approval request. Please wait for confirmation.',
    };
  }

  if (maxUsage != null && usedCount + pendingCount >= maxUsage) {
    return { valid: false, error: `You have used all ${maxUsage} claims for this benefit.` };
  }

  const vehicleNumber = normalizePlate(vehicleNumberInput);
  if (vehicleNumber) {
    const allowedPlates = allowedPlatesOverride || membershipVehiclePlates(membership);
    if (allowedPlates.size > 0 && !allowedPlates.has(vehicleNumber)) {
      return { valid: false, error: 'This benefit applies only to cars covered by your membership.' };
    }
  }

  return {
    valid: true,
    membership,
    benefit,
    benefitCode,
    benefitTitle: String(benefit.title || benefitCode),
    maxUsage,
    usedCount,
  };
}

export async function recordMembershipClaimUsage(
  supabaseAdmin: any,
  opts: {
    membership: any;
    customerId: string;
    benefitCode: string;
    referenceType: string;
    referenceId: string;
    usedValue?: number;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin.from('membership_usage').insert({
    customer_membership_id: opts.membership.id,
    customer_id: opts.customerId,
    benefit_code: opts.benefitCode,
    used_value: opts.usedValue ?? 1,
    reference_type: opts.referenceType,
    reference_id: opts.referenceId,
  });
  if (error) {
    return { ok: false, error: error.message || 'Failed to record membership claim' };
  }
  return { ok: true };
}

const REVOKABLE_LEAD_STATUSES = new Set(['NEW', 'PENDING', 'OPEN', 'ASSIGNED', 'ACCEPTED']);

export async function revokeMembershipBenefitClaim(
  supabaseAdmin: any,
  usageId: string,
  opts?: { adminUserId?: string | null },
): Promise<
  | {
      success: true;
      membership_id: string;
      benefit_code: string;
      lead_cancelled: boolean;
      warning?: string;
    }
  | { success: false; error: string }
> {
  const { data: usage, error: fetchError } = await supabaseAdmin
    .from('membership_usage')
    .select('id, customer_id, customer_membership_id, benefit_code, reference_type, reference_id')
    .eq('id', usageId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message || 'Could not load claim record.' };
  }
  if (!usage) {
    return { success: false, error: 'Claim record not found.' };
  }

  let leadCancelled = false;
  let warning: string | undefined;

  if (String(usage.reference_type || '').toUpperCase() === 'LEAD' && usage.reference_id) {
    const { data: lead } = await supabaseAdmin
      .from('service_leads')
      .select('id, status, meta')
      .eq('id', usage.reference_id)
      .maybeSingle();

    if (lead) {
      const leadStatus = String(lead.status || '').toUpperCase();
      if (REVOKABLE_LEAD_STATUSES.has(leadStatus)) {
        const meta =
          lead.meta && typeof lead.meta === 'object' && !Array.isArray(lead.meta)
            ? { ...(lead.meta as Record<string, unknown>) }
            : {};
        meta.membership_claim_revoked_at = new Date().toISOString();
        if (opts?.adminUserId) meta.membership_claim_revoked_by = opts.adminUserId;

        const { error: leadError } = await supabaseAdmin
          .from('service_leads')
          .update({
            status: 'CANCELLED',
            meta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        if (leadError) {
          return { success: false, error: leadError.message || 'Could not cancel linked booking.' };
        }
        leadCancelled = true;
      } else if (!['CANCELLED', 'CLOSED'].includes(leadStatus)) {
        warning =
          'Claim revoked and benefit restored, but the linked booking was already in progress and was not cancelled.';
      }
    }
  }

  const { error: deleteError } = await supabaseAdmin.from('membership_usage').delete().eq('id', usageId);
  if (deleteError) {
    return { success: false, error: deleteError.message || 'Could not revoke claim.' };
  }

  return {
    success: true,
    membership_id: String(usage.customer_membership_id),
    benefit_code: String(usage.benefit_code || '').toUpperCase(),
    lead_cancelled: leadCancelled,
    warning,
  };
}

export function parseMembershipClaimMeta(meta: unknown): MembershipClaimMeta | null {
  if (!meta || typeof meta !== 'object') return null;
  const claim = (meta as any).membership_claim;
  if (!claim?.benefit_code) return null;
  return {
    benefit_code: String(claim.benefit_code),
    benefit_title: String(claim.benefit_title || claim.benefit_code),
    vehicle_number: claim.vehicle_number ? String(claim.vehicle_number) : null,
    vehicle_label: claim.vehicle_label ? String(claim.vehicle_label) : null,
  };
}

const BENEFIT_SERVICE_LABEL: Record<string, string> = {
  PERIODIC_10_OFF: 'Periodic Service (Membership 10% Off)',
  FREE_INSPECTION: 'Free Top-Up & Inspection (Membership)',
  FREE_SCAN: 'Free Car Scanning (Membership)',
  DAMAGE_ASSESS: 'Insurance Claim Help (Membership)',
};

type ResolvedMembershipVehicle = {
  vehicle_number: string;
  make: string | null;
  model: string | null;
  vehicle_label: string;
};

export type MembershipClaimVehicleHint = {
  vehicle_number?: string | null;
  make?: string | null;
  model?: string | null;
  vehicle_label?: string | null;
};

function snapshotToVehicle(snapshot: any): ResolvedMembershipVehicle | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const vehicle_number = normalizePlate(snapshot.vehicle_number);
  if (!vehicle_number) return null;
  const make = snapshot.make ? String(snapshot.make) : null;
  const model = snapshot.model ? String(snapshot.model) : null;
  return {
    vehicle_number,
    make,
    model,
    vehicle_label: [make, model].filter(Boolean).join(' ') || vehicle_number,
  };
}

export async function fetchMembershipVehicleCandidates(
  supabaseAdmin: any,
  customerId: string,
  membership: any,
): Promise<ResolvedMembershipVehicle[]> {
  const byPlate = new Map<string, ResolvedMembershipVehicle>();

  const addVehicle = (vehicle: ResolvedMembershipVehicle | null) => {
    if (vehicle && !byPlate.has(vehicle.vehicle_number)) {
      byPlate.set(vehicle.vehicle_number, vehicle);
    }
  };

  addVehicle(snapshotToVehicle(membership?.primary_vehicle_snapshot));
  if (membership?.has_second_car) {
    addVehicle(snapshotToVehicle(membership?.second_vehicle_snapshot));
  }

  const linkedVehicleIds = [membership?.primary_vehicle_id, membership?.second_vehicle_id].filter(Boolean);
  if (linkedVehicleIds.length > 0) {
    const { data: linkedRows } = await supabaseAdmin
      .from('customer_vehicles')
      .select('vehicle_number, make, model, model_name')
      .in('id', linkedVehicleIds);
    for (const row of linkedRows || []) {
      addVehicle(
        snapshotToVehicle({
          vehicle_number: row.vehicle_number,
          make: row.make,
          model: row.model || row.model_name,
        }),
      );
    }
  }

  const { data: customerRows } = await supabaseAdmin
    .from('customer_vehicles')
    .select('vehicle_number, make, model, model_name, is_default')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .limit(10);

  for (const row of customerRows || []) {
    addVehicle(
      snapshotToVehicle({
        vehicle_number: row.vehicle_number,
        make: row.make,
        model: row.model || row.model_name,
      }),
    );
  }

  return Array.from(byPlate.values());
}

export async function resolveMembershipClaimVehicle(
  supabaseAdmin: any,
  customerId: string,
  membership: any,
  vehicleNumberInput?: string | null,
  vehicleHint?: MembershipClaimVehicleHint | null,
): Promise<ResolvedMembershipVehicle | null> {
  const candidates = await fetchMembershipVehicleCandidates(supabaseAdmin, customerId, membership);
  const requested = normalizePlate(vehicleNumberInput || vehicleHint?.vehicle_number);

  if (requested) {
    const matched = candidates.find((v) => v.vehicle_number === requested);
    if (matched) return matched;

    const make = vehicleHint?.make ? String(vehicleHint.make) : null;
    const model = vehicleHint?.model ? String(vehicleHint.model) : null;
    const vehicle_label =
      (vehicleHint?.vehicle_label ? String(vehicleHint.vehicle_label) : '') ||
      [make, model].filter(Boolean).join(' ') ||
      requested;

    return {
      vehicle_number: requested,
      make,
      model,
      vehicle_label,
    };
  }

  return candidates[0] || null;
}

function generateLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

export async function createAutoMembershipClaimBooking(
  supabaseAdmin: any,
  customer: { id: string; phone: string; full_name?: string | null },
  benefitCodeInput: string,
  vehicleHint?: MembershipClaimVehicleHint | null,
): Promise<
  | {
      success: true;
      lead: { id: string; lead_number: string; status: string | null };
      claim: MembershipClaimMeta & { auto_claimed: boolean };
    }
  | { success: false; error: string }
> {
  const membership = await getActiveCustomerMembership(supabaseAdmin, customer.id);
  if (!membership) {
    return { success: false, error: 'Active membership required to claim this benefit.' };
  }

  const vehicle = await resolveMembershipClaimVehicle(
    supabaseAdmin,
    customer.id,
    membership,
    vehicleHint?.vehicle_number,
    vehicleHint,
  );
  if (!vehicle) {
    return { success: false, error: 'No vehicle linked to your membership.' };
  }

  const candidatePlates = new Set(
    (await fetchMembershipVehicleCandidates(supabaseAdmin, customer.id, membership)).map(
      (v) => v.vehicle_number,
    ),
  );
  candidatePlates.add(vehicle.vehicle_number);

  const validated = await validateMembershipClaim(
    supabaseAdmin,
    customer.id,
    benefitCodeInput,
    vehicle.vehicle_number,
    candidatePlates,
  );
  if (!validated.valid) {
    return { success: false, error: validated.error };
  }

  const { data: addresses } = await supabaseAdmin
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customer.id)
    .order('is_default', { ascending: false })
    .limit(5);

  const defaultAddress = (addresses || []).find((a: any) => a.is_default) || (addresses || [])[0];
  const addressLine = defaultAddress
    ? [defaultAddress.address_line1, defaultAddress.address_line2, defaultAddress.landmark]
        .filter(Boolean)
        .join(', ')
    : null;
  const city = defaultAddress?.city ? String(defaultAddress.city) : null;

  const membershipClaimMeta = {
    benefit_code: validated.benefitCode,
    benefit_title: validated.benefitTitle,
    vehicle_number: vehicle.vehicle_number,
    vehicle_label: vehicle.vehicle_label,
    auto_claimed: true,
  };

  const normalizedPhone = normalizeCustomerPhone(customer.phone);
  if (!normalizedPhone) {
    return { success: false, error: 'Invalid customer phone on your account.' };
  }

  const serviceLabel =
    BENEFIT_SERVICE_LABEL[validated.benefitCode] || validated.benefitTitle;
  const leadNumber = generateLeadNumber();

  const leadInsert = {
    lead_number: leadNumber,
    customer_name: customer.full_name || `Customer ${normalizedPhone}`,
    customer_phone: normalizedPhone,
    vehicle_make: vehicle.make,
    vehicle_model: vehicle.model,
    vehicle_number: vehicle.vehicle_number,
    city,
    address: addressLine,
    customer_address: addressLine,
    pickup_address: addressLine,
    pickup_required: true,
    service_type: serviceLabel.slice(0, 100),
    description: `[Membership Claim] ${validated.benefitTitle} · ${vehicle.vehicle_number}`,
    status: 'NEW',
    lead_type: 'NORMAL',
    lead_source: 'Membership Claim',
    created_from: 'MOBILE_APP',
    lead_priority: 'HIGH',
    estimated_amount: 0,
    actual_amount: 0,
    meta: {
      customer_id: customer.id,
      membership_claim: membershipClaimMeta,
    },
  };

  const { data: serviceLead, error: leadError } = await supabaseAdmin
    .from('service_leads')
    .insert(leadInsert)
    .select('id, lead_number, status')
    .single();

  if (leadError || !serviceLead) {
    return { success: false, error: leadError?.message || 'Unable to create membership claim booking.' };
  }

  const usageResult = await recordMembershipClaimUsage(supabaseAdmin, {
    membership: validated.membership,
    customerId: customer.id,
    benefitCode: validated.benefitCode,
    referenceType: 'LEAD',
    referenceId: String(serviceLead.id),
    usedValue: 1,
  });

  if (!usageResult.ok) {
    await supabaseAdmin.from('service_leads').delete().eq('id', serviceLead.id);
    return {
      success: false,
      error:
        usageResult.error ||
        'Unable to record this claim. Please try again or contact support.',
    };
  }

  try {
    await pushServiceLeadToTeleCRM({ ...leadInsert, ...serviceLead }, supabaseAdmin, {
      leadTag: 'APP',
      leadSource: 'Membership Claim',
      createdFrom: 'MOBILE_APP',
      systemNote: `Lead Source: Membership Claim · ${validated.benefitTitle}`,
    });
  } catch (syncErr: unknown) {
    const message = syncErr instanceof Error ? syncErr.message : String(syncErr);
    console.error('[membership-claim] TeleCRM sync failed:', message);
  }

  return {
    success: true,
    lead: {
      id: String(serviceLead.id),
      lead_number: String(serviceLead.lead_number || leadNumber),
      status: serviceLead.status || 'NEW',
    },
    claim: membershipClaimMeta,
  };
}
