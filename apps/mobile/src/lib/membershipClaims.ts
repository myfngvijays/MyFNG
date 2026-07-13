import type { ValueCardBenefit } from './membershipPlan';
import { apiFetch } from './api';

export const CLAIMABLE_MEMBERSHIP_BENEFIT_CODES = new Set([
  'PERIODIC_10_OFF',
  'FREE_INSPECTION',
  'FREE_SCAN',
  'DAMAGE_ASSESS',
]);

/** Fallback codes aligned with DB display_order when benefit_code is missing from CMS payload. */
export const FALLBACK_BENEFIT_CODES = [
  'PERIODIC_10_OFF',
  'CASHBACK_5',
  'FREE_INSPECTION',
  'FREE_SCAN',
  'DAMAGE_ASSESS',
  'WHATSAPP_GROUP',
  'PRIORITY_BOOKING',
  'EXTENDED_WARRANTY',
];

export type MembershipClaimRouteParams = {
  benefitCode: string;
  benefitTitle: string;
  vehicleNumber?: string;
  vehicleLabel?: string;
  serviceCategory?: string;
};

export type MembershipBenefitStatusRow = {
  benefit_code: string;
  title: string;
  max_usage: number | null;
  used_count: number;
  remaining: number | null;
  pending_count?: number;
  approval_pending?: boolean;
  show_claim_button: boolean;
  claimable: boolean;
};

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

export type MembershipBenefitsStatusResponse = {
  benefits?: MembershipBenefitStatusRow[];
  history?: MembershipClaimHistoryRow[];
  pending_requests?: MembershipClaimRequestRow[];
  claims_unlocked?: boolean;
  claims_unlock_message?: string | null;
};

export type MembershipClaimHistoryRow = {
  id: string;
  benefit_code: string;
  benefit_title: string;
  vehicle_number: string | null;
  vehicle_label: string | null;
  created_at: string;
  reviewed_at?: string | null;
  claim_status?: string | null;
  lead_number: string | null;
  lead_status: string | null;
};

export function formatClaimHistoryStatus(status?: string | null): string {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED') return 'Rejected';
  if (normalized === 'PENDING') return 'Pending';
  return normalized ? normalized.replace(/_/g, ' ') : 'Pending';
}

export const MEMBERSHIP_CLAIM_SERVICE_CATEGORY: Record<string, string | undefined> = {
  PERIODIC_10_OFF: 'PERIODIC',
  FREE_INSPECTION: undefined,
  FREE_SCAN: undefined,
  DAMAGE_ASSESS: 'DENTING',
};

export function isBenefitClaimButtonEnabled(
  benefit: ValueCardBenefit,
  status?: MembershipBenefitStatusRow | null,
  claimsUnlocked = true,
): boolean {
  if (!claimsUnlocked) return false;
  if (status != null) return status.show_claim_button === true;
  return benefit.showClaimButton === true;
}

/** @deprecated Use isBenefitClaimButtonEnabled with plan/API data instead */
export function isClaimableBenefitCode(code?: string | null): boolean {
  return CLAIMABLE_MEMBERSHIP_BENEFIT_CODES.has(String(code || '').toUpperCase());
}

export function resolveBenefitCode(benefit: ValueCardBenefit, index: number): string | null {
  const explicit = String(benefit.benefitCode || '').toUpperCase();
  if (explicit) return explicit;
  return FALLBACK_BENEFIT_CODES[index] || null;
}

export function formatClaimRemaining(status?: MembershipBenefitStatusRow | null): string | null {
  if (!status) return null;
  if (status.max_usage == null) return null;
  const remaining = status.remaining ?? Math.max(0, status.max_usage - status.used_count);
  return `${remaining}/${status.max_usage} left`;
}

export function formatClaimHistoryDate(iso: string): string {
  if (!iso) return '-';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function submitMembershipBenefitClaim(
  benefitCode: string,
  vehicle?: {
    vehicle_number?: string;
    make?: string;
    model?: string;
    vehicle_label?: string;
    label?: string;
  },
): Promise<{
  success?: boolean;
  error?: string;
  lead?: { id: string; lead_number: string; status?: string | null };
  claim?: {
    benefit_code: string;
    benefit_title: string;
    vehicle_number?: string | null;
    vehicle_label?: string | null;
  };
  benefits?: MembershipBenefitStatusRow[];
  history?: MembershipClaimHistoryRow[];
  pending_requests?: MembershipClaimRequestRow[];
  claims_unlocked?: boolean;
  claims_unlock_message?: string | null;
  pending?: boolean;
  message?: string;
  request?: MembershipClaimRequestRow;
}> {
  return apiFetch('/api/customer/membership/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      benefit_code: benefitCode,
      vehicle_number: vehicle?.vehicle_number || undefined,
      vehicle_make: vehicle?.make || undefined,
      vehicle_model: vehicle?.model || undefined,
      vehicle_label: vehicle?.vehicle_label || vehicle?.label || undefined,
    }),
  });
}
