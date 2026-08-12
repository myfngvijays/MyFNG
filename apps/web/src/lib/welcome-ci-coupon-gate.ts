import 'server-only';
import {
  buildCustomerLeadOrFilter,
  filterLeadsForCustomer,
  normalizeCustomerPhone,
} from '@/lib/customer-service-leads';
import { COMPLETED_SERVICE_LEAD_STATUSES } from '@/lib/membership-benefits-service';

export const WELCOME_CI_UNLOCK_RULE = 'first_completed_non_inspection_service';

export const WELCOME_CI_PROFILE_MESSAGE =
  'Pehle profile complete karo — name, car model aur car number add karo, phir coupon use kar sakte ho.';

export const WELCOME_CI_SERVICE_LOCK_MESSAGE =
  'Coupon unlock ho gaya hai, lekin active tab hoga jab aapki pehli service book + complete ho jaye (Car Inspection isme count nahi hota).';

function isInspectionLead(lead: {
  service_type?: string | null;
  description?: string | null;
  problem_description?: string | null;
  coupon_meta?: unknown;
  meta?: unknown;
}): boolean {
  const parts = [
    lead.service_type,
    lead.description,
    lead.problem_description,
    typeof lead.coupon_meta === 'object' && lead.coupon_meta
      ? JSON.stringify(lead.coupon_meta)
      : '',
    typeof lead.meta === 'object' && lead.meta ? JSON.stringify(lead.meta) : '',
  ]
    .join(' ')
    .toLowerCase();
  return /car\s*inspection|health\s*check(?:up)?|welcome_ci1000|free_inspection|welcome\s*special/.test(
    parts,
  );
}

function isCompletedStatus(status: unknown): boolean {
  const normalized = String(status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return (COMPLETED_SERVICE_LEAD_STATUSES as readonly string[]).includes(normalized);
}

function isMembershipClaimLead(lead: { meta?: unknown } | null | undefined): boolean {
  if (!lead?.meta || typeof lead.meta !== 'object') return false;
  return Boolean((lead.meta as { membership_claim?: { benefit_code?: string } }).membership_claim?.benefit_code);
}

export function parseWelcomeCiAssignmentNotes(raw: unknown): {
  source?: string;
  assignment_status?: string;
  unlock_rule?: string;
} | null {
  if (!raw) return null;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  return obj;
}

export function isWelcomeCiGatedCoupon(coupon: {
  code?: string | null;
  coupon_type_slug?: string | null;
  campaign_name?: string | null;
}): boolean {
  const code = String(coupon.code || '').toUpperCase();
  const slug = String(coupon.coupon_type_slug || '').toLowerCase();
  const campaign = String(coupon.campaign_name || '').toLowerCase();
  return (
    code === 'WELCOME_CI1000' ||
    slug === 'welcome_special' ||
    campaign.includes('special welcome')
  );
}

export function isWelcomeCiGatedAssignment(notes: unknown): boolean {
  const parsed = parseWelcomeCiAssignmentNotes(notes);
  if (!parsed) return false;
  if (parsed.source === 'welcome_bonus_phone_override') return true;
  if (parsed.unlock_rule === WELCOME_CI_UNLOCK_RULE) return true;
  return String(parsed.assignment_status || '').toUpperCase() === 'LOCKED';
}

export async function customerHasCompletedNonInspectionService(
  supabaseAdmin: any,
  customer: { id: string; phone?: string | null },
): Promise<boolean> {
  const phone = normalizeCustomerPhone(customer.phone);
  if (!phone && !customer.id) return false;

  const { data: leads } = await supabaseAdmin
    .from('service_leads')
    .select(
      'id, status, meta, coupon_meta, service_type, description, problem_description, customer_phone, created_at, completed_at, updated_at',
    )
    .or(buildCustomerLeadOrFilter({ id: customer.id, phone: phone || undefined }))
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(120);

  const filtered = filterLeadsForCustomer(leads || [], {
    id: customer.id,
    phone: phone || null,
  });

  return filtered.some(
    (lead) =>
      isCompletedStatus(lead.status) &&
      !isMembershipClaimLead(lead) &&
      !isInspectionLead(lead),
  );
}

export async function getCustomerCouponProfileGate(
  supabaseAdmin: any,
  customerId: string,
): Promise<{
  ok: boolean;
  missing: string[];
  full_name: string | null;
  has_vehicle: boolean;
  message: string | null;
}> {
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, full_name, phone')
    .eq('id', customerId)
    .maybeSingle();

  const fullName = String(customer?.full_name || '').trim();
  const looksDefault = !fullName || /^user\s*\d+$/i.test(fullName);
  const missing: string[] = [];
  if (looksDefault) missing.push('name');

  const { data: vehicles } = await supabaseAdmin
    .from('customer_vehicles')
    .select('id, make, model, vehicle_number')
    .eq('customer_id', customerId)
    .limit(20);

  const usable = (vehicles || []).find((v: any) => {
    const makeModel = `${v.make || ''} ${v.model || ''}`.trim();
    const plate = String(v.vehicle_number || '')
      .replace(/\s+/g, '')
      .toUpperCase();
    const plateOk = plate.length >= 4 && !['NA', 'N/A', 'NONE', 'NULL'].includes(plate);
    return Boolean(makeModel) && plateOk;
  });

  if (!usable) missing.push('car_model_and_number');

  return {
    ok: missing.length === 0,
    missing,
    full_name: looksDefault ? null : fullName,
    has_vehicle: Boolean(usable),
    message: missing.length ? WELCOME_CI_PROFILE_MESSAGE : null,
  };
}

export type WelcomeCiCouponGateResult = {
  gated: boolean;
  locked: boolean;
  profile_ok: boolean;
  service_unlocked: boolean;
  can_use: boolean;
  lock_reason: 'profile' | 'service' | null;
  message: string | null;
};

export async function evaluateWelcomeCiCouponGate(
  supabaseAdmin: any,
  customer: { id: string; phone?: string | null },
  coupon: { code?: string | null; coupon_type_slug?: string | null; campaign_name?: string | null },
  assignmentNotes?: unknown,
): Promise<WelcomeCiCouponGateResult> {
  const gated =
    isWelcomeCiGatedCoupon(coupon) || isWelcomeCiGatedAssignment(assignmentNotes);
  if (!gated) {
    return {
      gated: false,
      locked: false,
      profile_ok: true,
      service_unlocked: true,
      can_use: true,
      lock_reason: null,
      message: null,
    };
  }

  const profile = await getCustomerCouponProfileGate(supabaseAdmin, customer.id);
  const serviceUnlocked = await customerHasCompletedNonInspectionService(supabaseAdmin, customer);

  if (!profile.ok) {
    return {
      gated: true,
      locked: true,
      profile_ok: false,
      service_unlocked: serviceUnlocked,
      can_use: false,
      lock_reason: 'profile',
      message: WELCOME_CI_PROFILE_MESSAGE,
    };
  }

  if (!serviceUnlocked) {
    return {
      gated: true,
      locked: true,
      profile_ok: true,
      service_unlocked: false,
      can_use: false,
      lock_reason: 'service',
      message: WELCOME_CI_SERVICE_LOCK_MESSAGE,
    };
  }

  return {
    gated: true,
    locked: false,
    profile_ok: true,
    service_unlocked: true,
    can_use: true,
    lock_reason: null,
    message: null,
  };
}
