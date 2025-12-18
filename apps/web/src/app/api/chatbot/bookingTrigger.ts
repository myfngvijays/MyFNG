import type { BookingResult, ChatbotContext, IntentDetectionResult, ServiceSuggestion } from './types';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

function normalizePhone(phone: string) {
  // Keep digits only; preserve last 10 for India numbers.
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function ensureLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingValidationError';
  }
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ADMIN_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      supabaseAdmin: null as any,
      error:
        'Server is missing Supabase service key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY) or Supabase URL (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL). Without service role, RLS must allow public insert into service_leads.',
    };
  }

  const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { supabaseAdmin, error: null as string | null };
}

/**
 * Booking must respect existing flows:
 * - Insert into service_leads
 * - status must be NEW
 * - created_from must be CHATBOT
 * - No invoice/payment side-effects
 */
export async function triggerBooking(
  supabase: any,
  input: {
    context: ChatbotContext;
    intent: IntentDetectionResult;
    chosenSuggestion: ServiceSuggestion;
    packageServiceTypeIds?: string[];
  }
): Promise<BookingResult> {
  // Prefer service-role client to bypass RLS for public chatbot bookings.
  // This matches other server API routes in this repo.
  const { supabaseAdmin, error: adminErr } = getAdminClient();
  const db = supabaseAdmin || supabase;

  const ctx = input.context || {};

  const customerPhone = normalizePhone(ctx.customerPhone || '');
  if (customerPhone.length < 10) {
    throw new BookingValidationError('Booking ke liye 10-digit mobile number required hai.');
  }

  const vehicleNumber = (ctx.vehicleNumber || '').trim().toUpperCase();
  if (!vehicleNumber || vehicleNumber.length < 6) {
    throw new BookingValidationError('Booking ke liye vehicle number required hai. Example: MH12AB1234');
  }

  // Location mandatory for RSA; for normal booking we still require at least city.
  const hasCity = Boolean(ctx.cityId && ctx.cityName);
  const hasAddress = Boolean(ctx.addressText && ctx.addressText.trim().length > 5);

  if (input.intent.intent === 'RSA') {
    if (!hasAddress && !hasCity) {
      throw new BookingValidationError('RSA booking ke liye location (area/city/pincode) required hai.');
    }
  } else {
    if (!hasCity && !hasAddress) {
      throw new BookingValidationError('Booking ke liye city/location required hai.');
    }
  }

  const serviceTypeIds =
    input.chosenSuggestion.kind === 'PACKAGE'
      ? (input.packageServiceTypeIds || [])
      : [input.chosenSuggestion.id];

  if (!serviceTypeIds || serviceTypeIds.length === 0) {
    throw new BookingValidationError('Service selection missing hai.');
  }

  const pickupRequired = typeof ctx.pickupRequired === 'boolean' ? ctx.pickupRequired : true;

  const leadNumber = ensureLeadNumber();

  const customerName = (ctx.customerName || '').trim() || 'Customer';

  // Map chatbot payment method -> DB payment_mode (best-effort)
  const pm = (ctx.paymentMethod || '').toUpperCase();
  const paymentMode =
    pm === 'UPI' || pm === 'CARD'
      ? 'ONLINE'
      : pm === 'CASH'
        ? 'COD'
        : pm === 'PAY_LATER'
          ? 'COD'
          : null;

  const pickupAddress = (ctx.pickupAddress || ctx.addressText || '').trim() || null;

  const payload: any = {
    lead_number: leadNumber,
    created_from: 'CHATBOT',
    status: 'NEW',

    customer_name: customerName,
    customer_phone: customerPhone,
    vehicle_number: vehicleNumber,

    city: ctx.cityName || null,
    city_id: typeof ctx.cityId === 'string' && isUuid(ctx.cityId) ? ctx.cityId : null,

    vehicle_make: ctx.vehicleMake || null,
    model_id: typeof ctx.modelId === 'string' && isUuid(ctx.modelId) ? ctx.modelId : null,
    vehicle_model: ctx.vehicleModel || null,
    vehicle_variant: ctx.vehicleVariant || null,

    // Legacy required column in many schemas
    service_type: input.chosenSuggestion?.name || 'Service',
    service_type_ids: serviceTypeIds,

    pickup_required: pickupRequired,
    // Workshop column used across schema
    workshop_id: pickupRequired ? null : ctx.workshopId || null,

    address: ctx.addressText || null,
    customer_address: ctx.addressText || null,
    pickup_address: pickupRequired ? pickupAddress : null,

    // Store user-provided problem description if schema supports it
    problem_description: ctx.problemDescription || null,

    payment_mode: paymentMode,
    meta: {
      payment_method: ctx.paymentMethod || null,
      pickup_required: pickupRequired,
      source: 'chatbot',
    },

    lead_priority: 'NORMAL',
    created_at: new Date().toISOString(),
  };

  const { data: lead, error } = await db
    .from('service_leads')
    .insert([payload])
    .select('id, lead_number')
    .single();

  if (error) {
    // Helpful server-side debug (safe: no sensitive data)
    console.error('[CHATBOT] Booking insert error:', {
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    // If RLS blocks insert and we don't have service role configured, return a helpful error.
    if ((error as any).code === '42501' && !supabaseAdmin) {
      throw new BookingValidationError(adminErr || 'Booking cannot be created due to RLS.');
    }
    // Bubble up a safe message; keep internal details out of chat.
    throw new Error(error.message || 'Booking failed');
  }

  return {
    leadId: (lead as any).id,
    leadNumber: (lead as any).lead_number,
  };
}
