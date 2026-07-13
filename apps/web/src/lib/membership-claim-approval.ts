import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { pushServiceLeadToTeleCRM } from '@/lib/booking-telecrm-sync';
import { sendAutomationWhatsApp } from '@/lib/services/whatsappAutomation';
import { sendReplyButtonsMessage, sendTextMessage } from '@/lib/services/whatsappService';

type MembershipClaimVehicleHint = {
  vehicle_number?: string | null;
  make?: string | null;
  model?: string | null;
  vehicle_label?: string | null;
};

async function loadMembershipBenefitsService() {
  return import('@/lib/membership-benefits-service');
}

export const MEMBERSHIP_CLAIM_APPROVE_PREFIX = 'mc_appr:';
export const MEMBERSHIP_CLAIM_REJECT_PREFIX = 'mc_rej:';

const BENEFIT_SERVICE_LABEL: Record<string, string> = {
  PERIODIC_10_OFF: 'Periodic Service (Membership 10% Off)',
  FREE_INSPECTION: 'Free Top-Up & Inspection (Membership)',
  FREE_SCAN: 'Free Car Scanning (Membership)',
  DAMAGE_ASSESS: 'Insurance Claim Help (Membership)',
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

function getApprovalWhatsAppNumbers(): string[] {
  return (process.env.SYSTEM_ALERT_WHATSAPP_NUMBERS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function generateLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

function buildApproveButtonId(requestId: string) {
  return `${MEMBERSHIP_CLAIM_APPROVE_PREFIX}${requestId}`;
}

function buildRejectButtonId(requestId: string) {
  return `${MEMBERSHIP_CLAIM_REJECT_PREFIX}${requestId}`;
}

function parseMembershipClaimButtonId(buttonId: string): { action: 'approve' | 'reject'; requestId: string } | null {
  const raw = String(buttonId || '').trim();
  if (raw.startsWith(MEMBERSHIP_CLAIM_APPROVE_PREFIX)) {
    const requestId = raw.slice(MEMBERSHIP_CLAIM_APPROVE_PREFIX.length);
    return requestId ? { action: 'approve', requestId } : null;
  }
  if (raw.startsWith(MEMBERSHIP_CLAIM_REJECT_PREFIX)) {
    const requestId = raw.slice(MEMBERSHIP_CLAIM_REJECT_PREFIX.length);
    return requestId ? { action: 'reject', requestId } : null;
  }
  return null;
}

function isAuthorizedApprovalPhone(senderPhone: string): boolean {
  const normalizedSender = normalizeCustomerPhone(senderPhone);
  if (!normalizedSender) return false;
  const allowed = getApprovalWhatsAppNumbers()
    .map((phone) => normalizeCustomerPhone(phone))
    .filter(Boolean);
  if (allowed.includes(normalizedSender)) return true;

  const senderDigits = String(senderPhone || '').replace(/\D/g, '');
  return allowed.some((phone) => {
    const allowedDigits = String(phone || '').replace(/\D/g, '');
    return (
      senderDigits.endsWith(phone) ||
      allowedDigits.endsWith(normalizedSender) ||
      senderDigits.endsWith(allowedDigits.slice(-10))
    );
  });
}

async function notifyCustomerClaimWhatsApp(
  triggerKey: 'membership_claim_submitted' | 'membership_claim_approved' | 'membership_claim_rejected',
  input: {
    customerId?: string | null;
    phone: string;
    customerName?: string | null;
    benefitTitle: string;
    vehicleLabel: string;
    bookingId?: string | null;
  },
) {
  const phone = String(input.phone || '').trim();
  if (!phone) return;

  const customerName = String(input.customerName || 'Customer').trim();
  const benefitTitle = String(input.benefitTitle || 'Membership benefit').trim();
  const vehicleLabel = String(input.vehicleLabel || 'Your car').trim();
  const bookingId = String(input.bookingId || '—').trim();

  const templateParams =
    triggerKey === 'membership_claim_approved'
      ? [customerName, benefitTitle, vehicleLabel, bookingId]
      : [customerName, benefitTitle, vehicleLabel];

  const automation = await sendAutomationWhatsApp({
    triggerKey,
    phone,
    customerId: input.customerId || null,
    templateParams,
    payload: { benefit_title: benefitTitle, vehicle: vehicleLabel, booking_id: bookingId },
    skipEnabledCheck: true,
    skipCooldownCheck: true,
  });

  if (automation.sent) return;

  const fallbackMessages: Record<typeof triggerKey, string> = {
    membership_claim_submitted: `Hi ${customerName},\n\nYour MyFNG Prime benefit request has been received.\n\nBenefit: ${benefitTitle}\nCar: ${vehicleLabel}\n\nOur team will review and confirm shortly.`,
    membership_claim_approved: `Hi ${customerName},\n\nGood news! Your MyFNG Prime benefit is approved.\n\nBenefit: ${benefitTitle}\nCar: ${vehicleLabel}\nBooking: ${bookingId}\n\nOur team will contact you shortly.`,
    membership_claim_rejected: `Hi ${customerName},\n\nYour MyFNG Prime benefit request could not be approved at this time.\n\nBenefit: ${benefitTitle}\nCar: ${vehicleLabel}\n\nPlease contact support or try again from the app.`,
  };

  await sendTextMessage(phone, fallbackMessages[triggerKey]);
}

async function notifyAdminsNewClaimRequest(input: {
  requestId: string;
  customerName: string;
  customerPhone: string;
  planName: string;
  benefitTitle: string;
  vehicleLabel: string;
  vehicleNumber: string;
}) {
  const recipients = getApprovalWhatsAppNumbers();
  if (recipients.length === 0) {
    console.warn('[membership-claim-approval] No approval WhatsApp numbers configured');
    return;
  }

  const body = [
    'New MyFNG Prime benefit claim',
    '',
    `Customer: ${input.customerName}`,
    `Phone: ${input.customerPhone}`,
    `Plan: ${input.planName}`,
    `Benefit: ${input.benefitTitle}`,
    `Car: ${input.vehicleLabel}`,
    `Number: ${input.vehicleNumber}`,
    '',
    'Tap Approve or Reject',
  ].join('\n');

  await Promise.all(
    recipients.map((phone) =>
      sendReplyButtonsMessage({
        phoneNumber: phone,
        header: 'Membership Claim',
        body,
        footer: 'MyFNG Admin',
        buttons: [
          { id: buildApproveButtonId(input.requestId), title: 'Approve' },
          { id: buildRejectButtonId(input.requestId), title: 'Reject' },
        ],
      }),
    ),
  );
}

export async function countPendingMembershipClaims(
  supabaseAdmin: any,
  membershipId: string,
  benefitCode?: string,
): Promise<number> {
  let query = supabaseAdmin
    .from('membership_claim_requests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_membership_id', membershipId)
    .eq('status', 'PENDING');

  if (benefitCode) {
    query = query.eq('benefit_code', String(benefitCode).toUpperCase());
  }

  const { count } = await query;
  return Number(count || 0);
}

export async function fetchPendingMembershipClaimRequests(
  supabaseAdmin: any,
  membershipId: string,
): Promise<MembershipClaimRequestRow[]> {
  const { data } = await supabaseAdmin
    .from('membership_claim_requests')
    .select('id, benefit_code, benefit_title, status, vehicle_number, vehicle_label, created_at')
    .eq('customer_membership_id', membershipId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  return (data || []).map((row: any) => ({
    id: String(row.id),
    benefit_code: String(row.benefit_code || '').toUpperCase(),
    benefit_title: String(row.benefit_title || row.benefit_code || ''),
    status: String(row.status || 'PENDING'),
    vehicle_number: row.vehicle_number ? String(row.vehicle_number) : null,
    vehicle_label: row.vehicle_label ? String(row.vehicle_label) : null,
    created_at: String(row.created_at || ''),
  }));
}

export async function submitMembershipClaimForApproval(
  supabaseAdmin: any,
  customer: { id: string; phone: string; full_name?: string | null },
  benefitCodeInput: string,
  vehicleHint?: MembershipClaimVehicleHint | null,
): Promise<
  | {
      success: true;
      request: MembershipClaimRequestRow;
      message: string;
    }
  | { success: false; error: string }
> {
  const {
    getActiveCustomerMembership,
    fetchMembershipVehicleCandidates,
    resolveMembershipClaimVehicle,
    validateMembershipClaim,
  } = await loadMembershipBenefitsService();

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

  const pendingForBenefit = await countPendingMembershipClaims(
    supabaseAdmin,
    String(membership.id),
    validated.benefitCode,
  );
  if (pendingForBenefit > 0) {
    return {
      success: false,
      error: 'This benefit already has a pending approval request. Please wait for confirmation.',
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('membership_claim_requests')
    .insert({
      customer_id: customer.id,
      customer_membership_id: membership.id,
      benefit_code: validated.benefitCode,
      benefit_title: validated.benefitTitle,
      vehicle_number: vehicle.vehicle_number,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
      vehicle_label: vehicle.vehicle_label,
      status: 'PENDING',
    })
    .select('id, benefit_code, benefit_title, status, vehicle_number, vehicle_label, created_at')
    .single();

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message || 'Could not submit claim for approval.' };
  }

  const request: MembershipClaimRequestRow = {
    id: String(inserted.id),
    benefit_code: String(inserted.benefit_code || '').toUpperCase(),
    benefit_title: String(inserted.benefit_title || ''),
    status: 'PENDING',
    vehicle_number: inserted.vehicle_number ? String(inserted.vehicle_number) : null,
    vehicle_label: inserted.vehicle_label ? String(inserted.vehicle_label) : null,
    created_at: String(inserted.created_at || ''),
  };

  const planName = String(membership.plan?.name || 'MyFNG Prime');
  const normalizedPhone = normalizeCustomerPhone(customer.phone) || customer.phone;

  void notifyAdminsNewClaimRequest({
    requestId: request.id,
    customerName: customer.full_name || 'Customer',
    customerPhone: normalizedPhone,
    planName,
    benefitTitle: validated.benefitTitle,
    vehicleLabel: vehicle.vehicle_label,
    vehicleNumber: vehicle.vehicle_number,
  }).catch((err) => {
    console.error('[membership-claim-approval] admin notify failed:', err?.message || err);
  });

  void notifyCustomerClaimWhatsApp('membership_claim_submitted', {
    customerId: customer.id,
    phone: customer.phone,
    customerName: customer.full_name,
    benefitTitle: validated.benefitTitle,
    vehicleLabel: vehicle.vehicle_label || vehicle.vehicle_number,
  }).catch((err) => {
    console.error('[membership-claim-approval] customer submit notify failed:', err?.message || err);
  });

  return {
    success: true,
    request,
    message: 'Your benefit request has been sent for approval. We will confirm on WhatsApp shortly.',
  };
}

async function finalizeApprovedMembershipClaim(
  supabaseAdmin: any,
  request: any,
  membership: any,
  customer: { id: string; phone: string; full_name?: string | null },
): Promise<
  | { success: true; lead: { id: string; lead_number: string }; usageId: string }
  | { success: false; error: string }
> {
  const { validateMembershipClaim, recordMembershipClaimUsage } = await loadMembershipBenefitsService();

  const benefitCode = String(request.benefit_code || '').toUpperCase();
  const benefitTitle = String(request.benefit_title || benefitCode);
  const vehicleNumber = String(request.vehicle_number || '').replace(/\s+/g, '').toUpperCase();

  const validated = await validateMembershipClaim(
    supabaseAdmin,
    customer.id,
    benefitCode,
    vehicleNumber,
    undefined,
    { ignorePendingRequestId: String(request.id) },
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
    benefit_code: benefitCode,
    benefit_title: benefitTitle,
    vehicle_number: vehicleNumber,
    vehicle_label: request.vehicle_label || vehicleNumber,
    auto_claimed: true,
    claim_request_id: String(request.id),
  };

  const normalizedPhone = normalizeCustomerPhone(customer.phone);
  if (!normalizedPhone) {
    return { success: false, error: 'Invalid customer phone on account.' };
  }

  const serviceLabel = BENEFIT_SERVICE_LABEL[benefitCode] || benefitTitle;
  const leadNumber = generateLeadNumber();

  const leadInsert = {
    lead_number: leadNumber,
    customer_name: customer.full_name || `Customer ${normalizedPhone}`,
    customer_phone: normalizedPhone,
    vehicle_make: request.vehicle_make || null,
    vehicle_model: request.vehicle_model || null,
    vehicle_number: vehicleNumber,
    city,
    address: addressLine,
    customer_address: addressLine,
    pickup_address: addressLine,
    pickup_required: true,
    service_type: serviceLabel.slice(0, 100),
    description: `[Membership Claim] ${benefitTitle} · ${vehicleNumber}`,
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
    benefitCode,
    referenceType: 'LEAD',
    referenceId: String(serviceLead.id),
    usedValue: 1,
  });

  if (!usageResult.ok) {
    await supabaseAdmin.from('service_leads').delete().eq('id', serviceLead.id);
    return { success: false, error: usageResult.error || 'Unable to record membership claim.' };
  }

  const { data: usageRow } = await supabaseAdmin
    .from('membership_usage')
    .select('id')
    .eq('customer_membership_id', validated.membership.id)
    .eq('benefit_code', benefitCode)
    .eq('reference_id', String(serviceLead.id))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    await pushServiceLeadToTeleCRM({ ...leadInsert, ...serviceLead }, supabaseAdmin, {
      leadTag: 'APP',
      leadSource: 'Membership Claim',
      createdFrom: 'MOBILE_APP',
      systemNote: `Lead Source: Membership Claim · ${benefitTitle}`,
    });
  } catch (syncErr: unknown) {
    const message = syncErr instanceof Error ? syncErr.message : String(syncErr);
    console.error('[membership-claim-approval] TeleCRM sync failed:', message);
  }

  return {
    success: true,
    lead: {
      id: String(serviceLead.id),
      lead_number: String(serviceLead.lead_number || leadNumber),
    },
    usageId: String(usageRow?.id || ''),
  };
}

export async function approveMembershipClaimRequest(
  supabaseAdmin: any,
  requestId: string,
  opts?: { reviewSource?: string; reviewedBy?: string | null },
): Promise<
  | {
      success: true;
      request: MembershipClaimRequestRow;
      lead: { id: string; lead_number: string };
    }
  | { success: false; error: string }
> {
  const { data: request, error } = await supabaseAdmin
    .from('membership_claim_requests')
    .select('*, customer:customers(id, phone, full_name), membership:customer_memberships(*, plan:membership_plans(name))')
    .eq('id', requestId)
    .maybeSingle();

  if (error || !request) {
    return { success: false, error: 'Claim request not found.' };
  }
  if (String(request.status) !== 'PENDING') {
    return { success: false, error: `Claim request is already ${String(request.status).toLowerCase()}.` };
  }

  const customer = request.customer;
  if (!customer?.id) {
    return { success: false, error: 'Customer not found for this claim request.' };
  }

  const finalized = await finalizeApprovedMembershipClaim(
    supabaseAdmin,
    request,
    request.membership,
    {
      id: String(customer.id),
      phone: String(customer.phone || ''),
      full_name: customer.full_name,
    },
  );

  if (!finalized.success) {
    return { success: false, error: finalized.error };
  }

  const reviewedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('membership_claim_requests')
    .update({
      status: 'APPROVED',
      lead_id: finalized.lead.id,
      membership_usage_id: finalized.usageId || null,
      reviewed_at: reviewedAt,
      review_source: opts?.reviewSource || 'ADMIN',
      reviewed_by: opts?.reviewedBy || null,
      updated_at: reviewedAt,
    })
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .select('id, benefit_code, benefit_title, status, vehicle_number, vehicle_label, created_at, reviewed_at')
    .single();

  if (updateError || !updated) {
    return { success: false, error: updateError?.message || 'Could not mark claim as approved.' };
  }

  void notifyCustomerClaimWhatsApp('membership_claim_approved', {
    customerId: String(customer.id),
    phone: String(customer.phone || ''),
    customerName: customer.full_name,
    benefitTitle: String(request.benefit_title || request.benefit_code),
    vehicleLabel: String(request.vehicle_label || request.vehicle_number || 'Your car'),
    bookingId: finalized.lead.lead_number,
  }).catch((err) => {
    console.error('[membership-claim-approval] customer approve notify failed:', err?.message || err);
  });

  return {
    success: true,
    request: {
      id: String(updated.id),
      benefit_code: String(updated.benefit_code || '').toUpperCase(),
      benefit_title: String(updated.benefit_title || ''),
      status: 'APPROVED',
      vehicle_number: updated.vehicle_number ? String(updated.vehicle_number) : null,
      vehicle_label: updated.vehicle_label ? String(updated.vehicle_label) : null,
      created_at: String(updated.created_at || ''),
      reviewed_at: updated.reviewed_at,
    },
    lead: finalized.lead,
  };
}

export async function rejectMembershipClaimRequest(
  supabaseAdmin: any,
  requestId: string,
  opts?: { reviewSource?: string; reviewedBy?: string | null; reviewNote?: string | null },
): Promise<{ success: true; request: MembershipClaimRequestRow } | { success: false; error: string }> {
  const { data: request, error } = await supabaseAdmin
    .from('membership_claim_requests')
    .select('*, customer:customers(id, phone, full_name)')
    .eq('id', requestId)
    .maybeSingle();

  if (error || !request) {
    return { success: false, error: 'Claim request not found.' };
  }
  if (String(request.status) !== 'PENDING') {
    return { success: false, error: `Claim request is already ${String(request.status).toLowerCase()}.` };
  }

  const reviewedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('membership_claim_requests')
    .update({
      status: 'REJECTED',
      reviewed_at: reviewedAt,
      review_source: opts?.reviewSource || 'ADMIN',
      reviewed_by: opts?.reviewedBy || null,
      review_note: opts?.reviewNote || null,
      updated_at: reviewedAt,
    })
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .select('id, benefit_code, benefit_title, status, vehicle_number, vehicle_label, created_at, reviewed_at, review_note')
    .single();

  if (updateError || !updated) {
    return { success: false, error: updateError?.message || 'Could not reject claim request.' };
  }

  const customer = request.customer;
  if (customer?.phone) {
    void notifyCustomerClaimWhatsApp('membership_claim_rejected', {
      customerId: String(customer.id),
      phone: String(customer.phone),
      customerName: customer.full_name,
      benefitTitle: String(request.benefit_title || request.benefit_code),
      vehicleLabel: String(request.vehicle_label || request.vehicle_number || 'Your car'),
    }).catch((err) => {
      console.error('[membership-claim-approval] customer reject notify failed:', err?.message || err);
    });
  }

  return {
    success: true,
    request: {
      id: String(updated.id),
      benefit_code: String(updated.benefit_code || '').toUpperCase(),
      benefit_title: String(updated.benefit_title || ''),
      status: 'REJECTED',
      vehicle_number: updated.vehicle_number ? String(updated.vehicle_number) : null,
      vehicle_label: updated.vehicle_label ? String(updated.vehicle_label) : null,
      created_at: String(updated.created_at || ''),
      reviewed_at: updated.reviewed_at,
      review_note: updated.review_note,
    },
  };
}

export function extractMembershipClaimButtonId(
  inbound: { type?: string; interactive?: unknown; button?: { payload?: string } },
): string {
  const messageType = String(inbound?.type || '').trim().toLowerCase();
  const interactivePayload =
    inbound?.interactive && typeof inbound.interactive === 'object'
      ? (inbound.interactive as { type?: string; button_reply?: { id?: string } })
      : null;
  if (interactivePayload?.type === 'button_reply') {
    return String(interactivePayload.button_reply?.id || '').trim();
  }
  if (messageType === 'button') {
    return String(inbound?.button?.payload || '').trim();
  }
  return '';
}

export async function tryHandleMembershipClaimWhatsAppReply(input: {
  supabaseAdmin: any;
  senderPhone: string;
  buttonId: string;
}): Promise<boolean> {
  const parsed = parseMembershipClaimButtonId(input.buttonId);
  if (!parsed) return false;

  if (!isAuthorizedApprovalPhone(input.senderPhone)) {
    await sendTextMessage(
      input.senderPhone,
      'This WhatsApp number is not authorized to approve membership claims.',
    );
    return true;
  }

  if (parsed.action === 'approve') {
    const result = await approveMembershipClaimRequest(input.supabaseAdmin, parsed.requestId, {
      reviewSource: 'WHATSAPP',
    });
    await sendTextMessage(
      input.senderPhone,
      result.success
        ? `Approved: ${result.request.benefit_title} · Booking #${result.lead.lead_number}`
        : `Could not approve: ${result.error}`,
    );
    return true;
  }

  const result = await rejectMembershipClaimRequest(input.supabaseAdmin, parsed.requestId, {
    reviewSource: 'WHATSAPP',
  });
  await sendTextMessage(
    input.senderPhone,
    result.success
      ? `Rejected: ${result.request.benefit_title}`
      : `Could not reject: ${result.error}`,
  );
  return true;
}
