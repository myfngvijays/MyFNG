import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';

export const LEAD_SOURCES = [
  'Google Ads',
  'Instagram Ads',
  'WhatsApp',
  'Website',
  'App Booking',
  'Banner/Offline',
  'Reference',
  'Partner',
  'Other',
] as const;

export const LEAD_TYPES = ['CAR_SERVICE', 'HOME_CAR_SERVICE', 'RSA', 'NORMAL', 'HOME_SERVICE'] as const;

function toEnquiryLeadType(input: string) {
  const raw = String(input || '').trim().toUpperCase();
  if (raw === 'CAR_SERVICE') return 'CAR_SERVICE';
  if (raw === 'HOME_CAR_SERVICE') return 'HOME_CAR_SERVICE';
  if (raw === 'RSA') return 'RSA';
  if (raw === 'NORMAL') return 'CAR_SERVICE';
  if (raw === 'HOME_SERVICE') return 'HOME_CAR_SERVICE';
  return null;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function ensureLeadNumber() {
  return `E-${Date.now().toString().slice(-8)}`;
}

type CreateLeadInput = {
  body: any;
  leadSourceOverride?: string | null;
};

export async function createLeadFromBody({ body, leadSourceOverride }: CreateLeadInput) {
  const leadType = toEnquiryLeadType(String(body?.lead_type || 'CAR_SERVICE'));
  const leadSource = String(leadSourceOverride ?? body?.lead_source ?? '').trim();
  const otherNoteRaw = String(body?.lead_source_other_note || '').trim();
  const customerPhone = String(body?.customer_phone || '').replace(/\D/g, '').slice(-10);

  if (!leadType) {
    throw new ApiError('Invalid lead_type', 400);
  }
  if (!LEAD_SOURCES.includes(leadSource as any)) {
    throw new ApiError('Invalid lead_source', 400);
  }
  const otherNote = leadSource === 'Other' ? (otherNoteRaw || null) : null;
  if (leadSource === 'Other' && !otherNote) {
    throw new ApiError('lead_source_other_note is required for Other', 400);
  }
  if (!customerPhone) {
    throw new ApiError('customer_phone is required', 400);
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new ApiError(adminError || 'Admin client not configured', 500);
  }

  const now = new Date().toISOString();
  const leadNumber = ensureLeadNumber();

  const { telecallerId, reason } = await pickTelecallerWeightedRoundRobin();
  const assignedAt = telecallerId ? now : null;
  const leadStatus = telecallerId ? 'ASSIGNED' : 'NEW';

  const history: any[] = [{ type: 'CREATED', at: now, lead_type: leadType, lead_source: leadSource }];
  if (telecallerId) {
    history.push({ type: 'ASSIGNED', at: now, mode: 'AUTO', telecaller_id: telecallerId });
  } else if (reason) {
    history.push({ type: 'ASSIGNMENT_SKIPPED', at: now, reason });
  }

  const payload = {
    kind: 'LEAD',
    lead_number: leadNumber,
    lead_type: leadType,
    lead_status: leadStatus,
    lead_priority: String(body?.lead_priority || 'NORMAL').toUpperCase(),
    lead_source: leadSource,
    lead_source_other_note: otherNote,

    customer_name: body?.customer_name ? String(body.customer_name).slice(0, 100) : null,
    customer_phone: customerPhone,
    customer_alt_phone: body?.customer_alt_phone ? String(body.customer_alt_phone).slice(0, 20) : null,
    customer_email: body?.customer_email ? String(body.customer_email).slice(0, 120) : null,
    customer_address: body?.customer_address ? String(body.customer_address) : null,
    customer_city: body?.customer_city ? String(body.customer_city).slice(0, 100) : null,
    customer_pincode: body?.customer_pincode ? String(body.customer_pincode).slice(0, 10) : null,
    customer_lat: Number.isFinite(body?.customer_lat) ? Number(body.customer_lat) : null,
    customer_lng: Number.isFinite(body?.customer_lng) ? Number(body.customer_lng) : null,

    vehicle_number: body?.vehicle_number ? String(body.vehicle_number).slice(0, 20) : null,
    vehicle_make: body?.vehicle_make ? String(body.vehicle_make).slice(0, 60) : null,
    vehicle_model: body?.vehicle_model ? String(body.vehicle_model).slice(0, 80) : null,
    vehicle_variant: body?.vehicle_variant ? String(body.vehicle_variant).slice(0, 80) : null,
    vehicle_fuel_type: body?.vehicle_fuel_type ? String(body.vehicle_fuel_type).slice(0, 20) : null,

    problem_description: body?.problem_description ? String(body.problem_description) : null,
    pickup_required: Boolean(body?.pickup_required),
    preferred_slot_start: body?.preferred_slot_start || null,
    preferred_slot_end: body?.preferred_slot_end || null,

    assigned_telecaller_id: telecallerId,
    assigned_at: assignedAt,
    assignment_mode: 'AUTO',

    history,
    meta: reason ? { assignment_error: reason } : {},
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from('enquiry_hub')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ApiError(error.message, 500);
  }

  return {
    data,
    assigned_telecaller_id: telecallerId,
    assignment_reason: reason,
  };
}
