import { supabase } from './supabase';
import { getSession } from './session';

export interface BookingData {
  session_id: string;
  service_name: string;
  service_category: string;
  customer_name: string;
  phone_number: string;
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
}

const EXTERNAL_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const EXTERNAL_AUTOUPDATE_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

function formatConversation(history: { role: string; content: string }[]): string {
  if (!history || history.length === 0) return '(no conversation)';
  return history
    .map((msg) => `${msg.role === 'user' ? 'Customer' : 'AI Bot'}: ${msg.content}`)
    .join('\n');
}

async function pushChatbotBookingToExternalApi(booking: BookingData) {
  const phoneDigits = String(booking.phone_number || '').replace(/\D/g, '').slice(-10);

  let conversationText = '';
  try {
    const session = await getSession(booking.session_id);
    conversationText = formatConversation(session.history || []);
  } catch (err) {
    console.error('[BOOKING] Failed to fetch chat session for TeleCRM:', err);
    conversationText = '(could not fetch conversation)';
  }

  const payload = {
    fields: {
      Name: String(booking.customer_name || '').trim() || 'AI Chatbot Lead',
      Phone: phoneDigits ? `+91${phoneDigits}` : null,

      LEADTAG: 'AI Chatbot',
      LeadSource: 'AI Chatbot',
      LeadStatus: booking.status || 'pending',

      carModel: String(booking.car_model || '').trim() || null,
      VehicleModel: String(booking.car_model || '').trim() || null,
      ServiceType: booking.service_name || booking.service_category || null,

      City: booking.city || null,
      Pincode: booking.pincode || null,
      Address: booking.address || null,

      PreferredSlotStart: booking.preferred_date
        ? `${booking.preferred_date}${booking.preferred_time ? 'T' + booking.preferred_time : ''}`
        : null,

      EstimatedAmount: booking.quoted_price ?? null,

      CreatedFrom: 'AI_CHATBOT',
      CreatedAt: new Date().toISOString(),
    },
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: `Lead Source: AI Chatbot | Service: ${booking.service_name || '-'} | Notes: ${booking.notes || '-'}`,
      },
      {
        type: 'SYSTEM_NOTE',
        text: `--- AI Chatbot Conversation ---\n${conversationText}`,
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

export async function saveBooking(bookingData: BookingData): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    if (!supabase) {
      console.error('[BOOKING] Supabase client not initialized');
      return { success: false, error: 'Database not available' };
    }

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
          notes: bookingData.notes,
          source: 'chatbot',
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('[BOOKING] Error saving to database:', error);
      return { success: false, error: error.message };
    }

    console.log('[BOOKING] Successfully saved to database:', data);

    try {
      await pushChatbotBookingToExternalApi(bookingData);
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
