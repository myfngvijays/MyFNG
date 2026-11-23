import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';
import { isPlaceholderCustomerName } from '@/lib/otp-stub-lead';
import {
  currentLeadStatusLabel,
  findLatestServiceLeadByPhone,
  isWorkshopActiveStatus,
  stampLeadFreshWithHistory,
} from '@/lib/service-lead-reopen';

export const CAR_LOAN_LEAD_SOURCE = 'Car Loan';

type CarLoanInput = {
  phone: string;
  fullName?: string | null;
  vehicleNumber?: string | null;
  loanAmount?: number | null;
  income?: number | null;
  occupation?: string | null;
  carLoanLeadId?: string | null;
};

function inr(n: unknown): string | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? `₹${Math.round(v).toLocaleString('en-IN')}` : null;
}

/**
 * Car loan page form → Fresh lead in Bookings & Leads / telecaller CRM with source "Car Loan".
 * Telecallers don't call these; they move them to Other · Car Loan (loan goes to iSanction).
 * PAN is never copied onto the CRM lead.
 */
export async function upsertCarLoanServiceLead(
  supabaseAdmin: any,
  input: CarLoanInput,
): Promise<{ leadId: string | null; created: boolean }> {
  const phone10 = normalizeCustomerPhone(input.phone);
  if (!phone10) return { leadId: null, created: false };

  const nowIso = new Date().toISOString();
  const name = String(input.fullName || '').trim();
  const vehicle = String(input.vehicleNumber || '').trim().toUpperCase();
  const summary = [
    'Car loan enquiry',
    inr(input.loanAmount) ? `Loan ${inr(input.loanAmount)}` : null,
    inr(input.income) ? `Income ${inr(input.income)}/month` : null,
    input.occupation ? String(input.occupation) : null,
    vehicle || null,
  ]
    .filter(Boolean)
    .join(' · ');
  const carLoanMeta = {
    car_loan: {
      at: nowIso,
      loan_amount: input.loanAmount ?? null,
      monthly_income: input.income ?? null,
      occupation: input.occupation || null,
      car_loan_lead_id: input.carLoanLeadId || null,
    },
  };

  const existing = await findLatestServiceLeadByPhone(supabaseAdmin, phone10);

  if (existing?.id) {
    const prevMeta =
      existing.coupon_meta && typeof existing.coupon_meta === 'object' ? existing.coupon_meta : {};
    const patch: Record<string, unknown> = {
      status: isWorkshopActiveStatus(existing.status) ? existing.status : 'NEW',
      lead_source: CAR_LOAN_LEAD_SOURCE,
      problem_description: summary,
      coupon_meta: stampLeadFreshWithHistory(
        { ...prevMeta, ...carLoanMeta, previous_lead_source: existing.lead_source || prevMeta.previous_lead_source || null },
        {
          nowIso,
          previousLabel: currentLeadStatusLabel(existing),
          previousStatus: String(existing.status || '') || null,
          sourceLabel: 'car loan enquiry',
          remark: summary,
          event: 'CAR_LOAN',
        },
      ),
      is_incomplete: false,
      deleted_at: null,
      updated_at: nowIso,
    };
    if (name && isPlaceholderCustomerName(existing.customer_name)) patch.customer_name = name;
    const { error } = await supabaseAdmin.from('service_leads').update(patch).eq('id', existing.id);
    if (error) {
      const slim = { ...patch };
      delete slim.is_incomplete;
      delete slim.deleted_at;
      delete slim.problem_description;
      const retry = await supabaseAdmin.from('service_leads').update(slim).eq('id', existing.id);
      if (retry.error) throw new Error(retry.error.message);
    }
    return { leadId: String(existing.id), created: false };
  }

  let assignedId: string | null = null;
  try {
    const picked = await pickTelecallerWeightedRoundRobin('ENQUIRY_API');
    assignedId = picked.telecallerId || null;
  } catch (err) {
    console.warn('[car-loan-lead] assign failed:', err);
  }

  const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const payload: Record<string, unknown> = {
    lead_number: leadNumber,
    lead_type: 'NORMAL',
    lead_source: CAR_LOAN_LEAD_SOURCE,
    created_from: 'WEB',
    status: 'NEW',
    customer_name: name || `Customer_${phone10.slice(-4)}`,
    customer_phone: phone10,
    vehicle_number: vehicle || 'NA',
    service_type: 'Car Loan',
    description: 'Car loan form',
    problem_description: summary,
    lead_priority: 'NORMAL',
    assigned_telecaller_id: assignedId,
    assigned_at: assignedId ? nowIso : null,
    coupon_meta: stampLeadFreshWithHistory(carLoanMeta, {
      nowIso,
      previousLabel: null,
      previousStatus: null,
      sourceLabel: 'car loan enquiry',
      remark: summary,
      event: 'CAR_LOAN',
    }),
    created_at: nowIso,
    updated_at: nowIso,
  };

  let { data, error } = await supabaseAdmin
    .from('service_leads')
    .insert([payload])
    .select('id, lead_number')
    .maybeSingle();
  if (error) {
    const slim = { ...payload };
    delete slim.lead_priority;
    delete slim.problem_description;
    delete slim.description;
    delete slim.assigned_at;
    ({ data, error } = await supabaseAdmin
      .from('service_leads')
      .insert([slim])
      .select('id, lead_number')
      .maybeSingle());
  }
  if (error || !data) throw new Error(error?.message || 'Car loan lead insert failed');

  void notifyTelecallerNewLeadAssignedSafe({
    leadId: String(data.id),
    leadNumber: String(data.lead_number || leadNumber),
    telecallerId: assignedId,
    assignedByName: 'Auto distribution',
    notes: summary,
  });

  return { leadId: String(data.id), created: true };
}
