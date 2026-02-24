import { supabase } from './supabase';

export interface BookingData {
  session_id: string;
  service_name: string;
  service_category: string;
  customer_name: string;
  phone_number: string;
  address: string;
  car_model: string;
  city: string;
  pincode?: string;
  preferred_date?: string;
  preferred_time?: string;
  status?: string;
}

export async function saveBooking(bookingData: BookingData): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!supabase) return { success: false, error: 'Database not available' };

  try {
    const { data, error } = await supabase
      .from('chatbot_bookings')
      .insert([
        {
          ...bookingData,
          status: bookingData.status || 'pending',
          source: 'chatbot',
        },
      ])
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch {
    return { success: false, error: 'Unexpected error occurred' };
  }
}
