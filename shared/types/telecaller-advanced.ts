/**
 * Telecaller Advanced Features Types
 * Phase 7G Implementation - EXACT schema match
 */

// ============================================
// 1. TELECALLER_CALL_LOGS TABLE
// ============================================
export interface TelecallerCallLog {
  id: string;
  lead_id: string; // NOT NULL
  telecaller_id: string; // NOT NULL
  call_type: string; // NOT NULL
  call_status: string; // NOT NULL
  call_duration: number | null;
  outcome: string | null;
  customer_response: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_time: string | null;
  phone_number: string | null;
  call_recording_url: string | null;
  created_at: string;
}

// ============================================
// 2. TELECALLER_FOLLOW_UPS TABLE
// ============================================
export interface TelecallerFollowUp {
  id: string;
  lead_id: string; // NOT NULL
  telecaller_id: string; // NOT NULL
  follow_up_type: string; // NOT NULL
  scheduled_time: string; // NOT NULL
  priority: string; // DEFAULT 'NORMAL'
  reason: string; // NOT NULL
  context_notes: string | null;
  status: string; // DEFAULT 'PENDING'
  completed_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  reminder_sent: boolean; // DEFAULT false
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 3. TELECALLER_SCRIPTS TABLE
// ============================================
export interface TelecallerScript {
  id: string;
  script_type: string; // NOT NULL
  script_title: string; // NOT NULL
  script_content: string; // NOT NULL
  language: string; // DEFAULT 'en'
  category: string | null;
  is_active: boolean; // DEFAULT true
  usage_count: number; // DEFAULT 0
  created_at: string;
  updated_at: string;
}

// INPUT TYPES
export interface CreateCallLogInput {
  lead_id: string;
  telecaller_id: string;
  call_type: string;
  call_status: string;
  call_duration?: number | null;
  outcome?: string | null;
  customer_response?: string | null;
  notes?: string | null;
  next_action?: string | null;
  next_action_time?: string | null;
  phone_number?: string | null;
  call_recording_url?: string | null;
}

export interface CreateFollowUpInput {
  lead_id: string;
  telecaller_id: string;
  follow_up_type: string;
  scheduled_time: string;
  priority?: string;
  reason: string;
  context_notes?: string | null;
}

export interface CreateScriptInput {
  script_type: string;
  script_title: string;
  script_content: string;
  language?: string;
  category?: string | null;
  is_active?: boolean;
}

// UTILITY TYPES
export type CallType = 'OUTBOUND' | 'INBOUND' | 'FOLLOW_UP' | 'COLD_CALL';
export type CallStatus = 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'INVALID_NUMBER' | 'REJECTED';
export type FollowUpType = 'REMINDER' | 'QUOTE_FOLLOW_UP' | 'COMPLAINT_FOLLOW_UP' | 'FEEDBACK' | 'UPSELL';
export type FollowUpPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

