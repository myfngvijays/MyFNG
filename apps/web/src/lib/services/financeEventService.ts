/**
 * Finance Event Service
 * Phase 1 - Invoice & Payment Flow
 * Purpose: Centralized service for logging financial events
 */

import { createClient } from '@/lib/supabase/server';

export type FinanceEventType =
  | 'invoice_created'
  | 'invoice_approved'
  | 'invoice_rejected'
  | 'invoice_sent'
  | 'invoice_viewed'
  | 'payment_received'
  | 'payment_failed'
  | 'payment_partial'
  | 'receipt_sent'
  | 'receipt_generated'
  | 'refund_requested'
  | 'refund_approved'
  | 'refund_processed'
  | 'refund_rejected'
  | 'payout_created'
  | 'payout_approved'
  | 'payout_executed'
  | 'payout_failed'
  | 'delivery_completed'
  | 'lead_archived'
  | 'gl_entries_posted'
  | 'chargeback_received';

export type FinanceEntityType = 'invoice' | 'payment' | 'payout' | 'refund' | 'receipt';

export interface FinanceEventData {
  [key: string]: any;
}

export interface CreateFinanceEventInput {
  eventType: FinanceEventType;
  entityType: FinanceEntityType;
  entityId: string;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  eventData?: FinanceEventData;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a finance event
 */
export async function createFinanceEvent(
  input: CreateFinanceEventInput
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get actor info if not provided
    let actorId = input.actorId;
    let actorRole = input.actorRole;
    let actorName = input.actorName;

    if (!actorId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('users_login')
          .select('id, role, name')
          .eq('email', user.email)
          .single();

        if (userProfile) {
          actorId = userProfile.id;
          actorRole = userProfile.role;
          actorName = userProfile.name;
        }
      }
    }

    const { data: event, error } = await supabase
      .from('finance_events')
      .insert({
        event_type: input.eventType,
        entity_type: input.entityType,
        entity_id: input.entityId,
        actor_id: actorId,
        actor_role: actorRole,
        actor_name: actorName,
        event_data: input.eventData || {},
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating finance event:', error);
      return { success: false, error: error.message };
    }

    return { success: true, eventId: event.id };
  } catch (error: any) {
    console.error('Error in createFinanceEvent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get finance events for an entity
 */
export async function getFinanceEvents(
  entityType: FinanceEntityType,
  entityId: string
): Promise<any[]> {
  try {
    const supabase = await createClient();

    const { data: events, error } = await supabase
      .from('finance_events')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching finance events:', error);
      return [];
    }

    return events || [];
  } catch (error) {
    console.error('Error in getFinanceEvents:', error);
    return [];
  }
}

/**
 * Get finance events by type
 */
export async function getFinanceEventsByType(
  eventType: FinanceEventType,
  limit: number = 100
): Promise<any[]> {
  try {
    const supabase = await createClient();

    const { data: events, error } = await supabase
      .from('finance_events')
      .select('*')
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching finance events by type:', error);
      return [];
    }

    return events || [];
  } catch (error) {
    console.error('Error in getFinanceEventsByType:', error);
    return [];
  }
}

