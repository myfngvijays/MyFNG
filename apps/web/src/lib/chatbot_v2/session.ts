import { supabase } from './supabase';

export interface SessionData {
  history: { role: string; content: string }[];
  workshopQuery?: boolean;
  lastShownWorkshops?: any[]; // Store recently shown workshops for selection
  lastShownPlans?: any[]; // Store service plans/pricing to handle plan selection
  lastBookingCompleted?: number; // Timestamp of last completed booking
  phoneVerification?: {
    phone: string;
    verifiedAt: string;
  };
  bookingState?: {
    selectedService?: string;
    selectedServicePlan?: {
      service_name: string;
      min_price: number;
      max_price: number;
      description?: string;
    };
    selectedWorkshop?: {
      name: string;
      address: string;
      city: string;
      pincode?: string;
      phone?: string;
    };
    customerName?: string;
    phoneNumber?: string;
    address?: string;
    carModel?: string;
    vehicleNumber?: string;
    city?: string;
    cityId?: string;
    pincode?: string;
    category?: string;
    preferredDate?: string;
    preferredTime?: string;
    summaryShown?: boolean;
    justConfirmed?: boolean; // Flag to prevent 'no' from canceling after confirmation

    // Conversational Booking Fields
    currentStep?:
      | 'ASKING_SERVICE'
      | 'ASKING_CAR'
      | 'ASKING_VEHICLE_NUMBER'
      | 'ASKING_CITY'
      | 'ASKING_PINCODE'
      | 'ASKING_NAME'
      | 'ASKING_PHONE'
      | 'ASKING_OTP'
      | 'ASKING_ADDRESS'
      | 'ASKING_DATE'
      | 'ASKING_TIME'
      | 'CONFIRMING';
    lastQuestion?: string; // Remember what we last asked
    interruptionCount?: number; // Track off-topic responses
    workshopAcknowledged?: boolean; // Flag to show workshop acknowledgment only once
    pricingShown?: boolean; // Flag to track if pricing has been shown to user
    awaitingBookingConfirmation?: boolean; // Flag to track if we're waiting for user to confirm booking after pricing
    bookingConfirmedByUser?: boolean;
  };
}

export async function getSession(sessionId: string): Promise<SessionData> {
  if (!supabase) {
    console.warn('[SESSION] Supabase client not initialized, using empty session');
    return { history: [], bookingState: {} };
  }

  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('data')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      console.log(`[SESSION] No active session found for ${sessionId}, creating new`);
      return { history: [], bookingState: {} };
    }

    console.log(`[SESSION] Retrieved session for ${sessionId}`);
    return data.data as SessionData;
  } catch (error) {
    console.error('[SESSION] Error retrieving session:', error);
    return { history: [], bookingState: {} };
  }
}

export async function saveSession(sessionId: string, data: SessionData): Promise<void> {
  if (!supabase) {
    console.warn('[SESSION] Supabase client not initialized, cannot save session');
    return;
  }

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error } = await supabase
      .from('chat_sessions')
      .upsert(
        {
          session_id: sessionId,
          data,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'session_id' }
      );

    if (error) {
      console.error('[SESSION] Error saving session:', error);
    } else {
      console.log(`[SESSION] Saved session for ${sessionId}`);
    }
  } catch (error) {
    console.error('[SESSION] Unexpected error saving session:', error);
  }
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!supabase) {
    console.warn('[SESSION] Supabase client not initialized, cannot delete session');
    return;
  }

  try {
    const { error } = await supabase.from('chat_sessions').delete().eq('session_id', sessionId);

    if (error) {
      console.error('[SESSION] Error deleting session:', error);
    } else {
      console.log(`[SESSION] Deleted session ${sessionId}`);
    }
  } catch (error) {
    console.error('[SESSION] Unexpected error deleting session:', error);
  }
}

/**
 * Clean up expired sessions (call this periodically or via cron)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  if (!supabase) {
    console.warn('[SESSION] Supabase client not initialized, cannot cleanup sessions');
    return 0;
  }

  try {
    const { data, error } = await supabase.rpc('cleanup_expired_sessions');

    if (error) {
      console.error('[SESSION] Error cleaning up sessions:', error);
      return 0;
    }

    console.log(`[SESSION] Cleaned up ${data} expired sessions`);
    return data || 0;
  } catch (error) {
    console.error('[SESSION] Unexpected error cleaning up sessions:', error);
    return 0;
  }
}
