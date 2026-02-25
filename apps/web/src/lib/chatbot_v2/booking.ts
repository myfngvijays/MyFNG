import { supabase } from './supabase';

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
