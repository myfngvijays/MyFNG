import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { pushServiceLeadToTeleCRM } from '@/lib/booking-telecrm-sync';

export const DEFAULT_BENEFIT_MAX_USAGE: Record<string, number | null> = {
  PERIODIC_10_OFF: null,
  FREE_INSPECTION: 2,
  FREE_SCAN: 2,
  DAMAGE_ASSESS: null,
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

export async function getMembershipBenefitsStatus(
  supabaseAdmin: any,
  customerId: string,
): Promise<{
  benefits: MembershipBenefitStatus[];
  history: MembershipClaimHistoryItem[];
}> {
  const membership = await getActiveCustomerMembership(supabaseAdmin, customerId);
  if (!membership) return { benefits: [], history: [] };

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

  const usageByCode: Record<string, number> = {};
  for (const row of usageRows || []) {
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
      const remaining = maxUsage == null ? null : Math.max(0, maxUsage - usedCount);
      const hasQuotaLeft = maxUsage == null ? true : usedCount < maxUsage;
      return {
        benefit_code: code,
        title: String(b.title || code),
        max_usage: maxUsage,
        used_count: usedCount,
        remaining,
        show_claim_button: true,
        claimable: hasQuotaLeft,
      };
    });

  const leadIds = (usageRows || [])
    .filter((r: any) => String(r.reference_type || '').toUpperCase() === 'LEAD' && r.reference_id)
    .map((r: any) => String(r.reference_id));

  const leadById: Record<string, any> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, status, vehicle_number, vehicle_make, vehicle_model, meta')
      .in('id', leadIds);
    for (const lead of leads || []) {
      leadById[String(lead.id)] = lead;
    }
  }

  const history: MembershipClaimHistoryItem[] = (usageRows || []).map((r: any) => {
      const code = String(r.benefit_code || '').toUpperCase();
      const lead = r.reference_id ? leadById[String(r.reference_id)] : null;
      const claimMeta = (lead?.meta as any)?.membership_claim || {};
      const vehicleLabel = claimMeta.vehicle_label
        || [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ')
        || null;
      return {
        id: String(r.id),
        benefit_code: code,
        benefit_title: String(claimMeta.benefit_title || titleByCode[code] || code),
        vehicle_number: claimMeta.vehicle_number || lead?.vehicle_number || null,
        vehicle_label: vehicleLabel,
        created_at: String(r.created_at || ''),
        reference_type: r.reference_type || null,
        reference_id: r.reference_id || null,
        lead_number: lead?.lead_number || null,
        lead_status: lead?.status || null,
      };
    });

  return { benefits, history };
}

export async function validateMembershipClaim(
  supabaseAdmin: any,
  customerId: string,
  benefitCodeInput: string,
  vehicleNumberInput?: string | null,
  allowedPlatesOverride?: Set<string>,
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

  const { count } = await supabaseAdmin
    .from('membership_usage')
    .select('id', { count: 'exact', head: true })
    .eq('customer_membership_id', membership.id)
    .eq('benefit_code', benefitCode);

  const usedCount = Number(count || 0);
  const maxUsage = resolveMaxUsage(benefit);
  if (maxUsage != null && usedCount >= maxUsage) {
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

async function fetchMembershipVehicleCandidates(
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
