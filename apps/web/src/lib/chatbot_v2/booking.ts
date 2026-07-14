import { supabase } from './supabase';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getMisaCreatedFrom,
  getMisaLeadSource,
  getMisaTelecrmTag,
  resolveMisaBookingChannel,
  type MisaBookingChannel,
} from './misaLeadSource';


export interface BookingData {
  session_id: string;
  service_name: string;
  service_category: string;
  customer_name: string;
  phone_number: string;
  vehicle_number: string;
  address: string;
  car_model: string;
  car_class?: string;
  city: string;
  pincode?: string;
  preferred_date?: string;
  preferred_time?: string;
  quoted_price?: number;
  status?: string;
  notes?: string;
  channel?: MisaBookingChannel;
}

const EXTERNAL_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const EXTERNAL_AUTOUPDATE_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

function resolveBookingChannel(booking: BookingData): MisaBookingChannel {
  return resolveMisaBookingChannel({
    channel: booking.channel,
    sessionId: booking.session_id,
  });
}

async function pushChatbotBookingToExternalApi(booking: BookingData, channel: MisaBookingChannel) {
  const phoneDigits = String(booking.phone_number || '').replace(/\D/g, '').slice(-10);
  const leadSource = getMisaLeadSource(channel);
  const leadTag = getMisaTelecrmTag(channel);

  const payload = {
    fields: {
      Name: String(booking.customer_name || '').trim() || `${leadSource} Lead`,
      Phone: phoneDigits ? `+91${phoneDigits}` : null,

      LEADTAG: leadTag,
      LeadSource: leadSource,
      LeadStatus: booking.status || 'pending',

      carModel: String(booking.car_model || '').trim() || null,
      VehicleModel: String(booking.car_model || '').trim() || null,
      VehicleNumber: String(booking.vehicle_number || '').trim() || null,
      vehicle_number: String(booking.vehicle_number || '').trim() || null,
      ServiceType: booking.service_name || booking.service_category || null,

      City: booking.city || null,
      Pincode: booking.pincode || null,
      Address: booking.address || null,

      PreferredSlotStart: booking.preferred_date
        ? `${booking.preferred_date}${booking.preferred_time ? 'T' + booking.preferred_time : ''}`
        : null,

      EstimatedAmount: booking.quoted_price ?? null,

      CreatedFrom: getMisaCreatedFrom(channel),
      CreatedAt: new Date().toISOString(),
    },
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: `Lead Source: ${leadSource}`,
      },
    ],
  };

  const res = await fetch(EXTERNAL_AUTOUPDATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${EXTERNAL_AUTOUPDATE_BEARER}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`External API failed: ${res.status} ${body || ''}`.trim());
  }
}

async function createServiceLead(bookingData: BookingData, channel: MisaBookingChannel): Promise<string | null> {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('[BOOKING] Admin client not available for service_leads insert');
      return null;
    }

    const phoneDigits = String(bookingData.phone_number || '').replace(/\D/g, '').slice(-10);
    if (!phoneDigits) return null;

    const leadNumber = `L-${Date.now().toString().slice(-8)}`;
    const nowIso = new Date().toISOString();
    const leadSource = getMisaLeadSource(channel);

    const payload: Record<string, any> = {
      lead_number: leadNumber,
      lead_type: 'NORMAL',
      lead_source: leadSource,
      created_from: getMisaCreatedFrom(channel),
      status: 'NEW',
      customer_name: bookingData.customer_name || `Customer_${phoneDigits.slice(-4)}`,
      customer_phone: phoneDigits,
      vehicle_number: bookingData.vehicle_number || 'NA',
      vehicle_model: bookingData.car_model || null,
      service_type: bookingData.service_name || bookingData.service_category || 'CAR_SERVICE',
      description: `${bookingData.service_name || ''} - ${bookingData.service_category || ''}`.trim().replace(/^-\s*|-\s*$/g, '') || null,
      city: bookingData.city || null,
      address: bookingData.address || null,
      pickup_address: bookingData.address || null,
      pincode: bookingData.pincode || null,
      preferred_date: bookingData.preferred_date || null,
      preferred_time_slot: bookingData.preferred_time || null,
      estimated_amount: bookingData.quoted_price || null,
      created_at: nowIso,
    };

    const { data, error } = await supabaseAdmin
      .from('service_leads')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      console.error('[BOOKING] service_leads insert failed:', error);
      return null;
    }

    console.log('[BOOKING] service_leads entry created:', data?.id);
    return data?.id || null;
  } catch (err) {
    console.error('[BOOKING] service_leads creation error:', err);
    return null;
  }
}

export async function saveBooking(bookingData: BookingData): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    if (!supabase) {
      console.error('[BOOKING] Supabase client not initialized');
      return { success: false, error: 'Database not available' };
    }

    const channel = resolveBookingChannel(bookingData);
    const leadSource = getMisaLeadSource(channel);

    const { data, error } = await supabase
      .from('chatbot_bookings')
      .insert([
        {
          session_id: bookingData.session_id,
          service_name: bookingData.service_name,
          service_category: bookingData.service_category,
          customer_name: bookingData.customer_name,
          phone_number: bookingData.phone_number,
          address: bookingData.address,
          car_model: bookingData.car_model,
          car_class: bookingData.car_class,
          city: bookingData.city,
          pincode: bookingData.pincode,
          preferred_date: bookingData.preferred_date,
          preferred_time: bookingData.preferred_time,
          quoted_price: bookingData.quoted_price,
          status: bookingData.status || 'pending',
          notes: bookingData.vehicle_number
            ? [bookingData.notes, `Vehicle: ${bookingData.vehicle_number}`].filter(Boolean).join(' | ')
            : bookingData.notes,
          source: leadSource,
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('[BOOKING] Error saving to database:', error);
      return { success: false, error: error.message };
    }

    console.log('[BOOKING] Successfully saved to database:', data);

    // Also create a service_leads entry so it appears in customer's order history
    await createServiceLead(bookingData, channel);

    try {
      await pushChatbotBookingToExternalApi(bookingData, channel);
      console.log('[BOOKING] External TeleCRM sync succeeded');
    } catch (syncErr) {
      console.error('[BOOKING] External TeleCRM sync failed (non-blocking):', syncErr);
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[BOOKING] Unexpected error:', err);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Get all bookings for a session
 */
export async function getBookingsBySession(sessionId: string) {
  try {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('chatbot_bookings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BOOKING] Error fetching bookings:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[BOOKING] Error:', err);
    return [];
  }
}
