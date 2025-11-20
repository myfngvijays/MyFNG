/**
 * Complaints & Fraud Management Types
 * Phase 7B Implementation
 * Matching EXACT database schema
 */

// ============================================
// 1. CUSTOMER_COMPLAINTS TABLE
// ============================================
export interface CustomerComplaint {
  id: string;
  complaint_number: string; // NOT NULL UNIQUE
  lead_id: string | null;
  customer_id: string | null;
  workshop_id: string | null;
  mechanic_id: string | null;
  pickup_boy_id: string | null;
  complaint_type: string; // NOT NULL
  complaint_category: string | null;
  severity: string; // DEFAULT 'MEDIUM'
  priority: string; // DEFAULT 'NORMAL'
  description: string; // NOT NULL
  customer_expected_resolution: string | null;
  attachments: string[]; // jsonb DEFAULT '[]'
  status: string; // DEFAULT 'OPEN'
  assigned_to: string | null;
  assigned_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolution: string | null;
  resolution_action_taken: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  customer_satisfied: boolean | null;
  customer_feedback: string | null;
  refund_requested: boolean; // DEFAULT false
  refund_issued: boolean; // DEFAULT false
  refund_amount: number; // DEFAULT 0
  refund_reference: string | null;
  compensation_provided: string | null;
  escalated_to_level: string | null;
  escalated_at: string | null;
  workshop_penalized: boolean; // DEFAULT false
  penalty_amount: number; // DEFAULT 0
  penalty_reason: string | null;
  follow_up_required: boolean; // DEFAULT true
  follow_up_count: number; // DEFAULT 0
  last_follow_up_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closure_notes: string | null;
  internal_notes: string | null;
  tags: string[]; // jsonb DEFAULT '[]'
  created_at: string;
  updated_at: string;
}

export interface CreateComplaintInput {
  lead_id?: string | null;
  customer_id?: string | null;
  workshop_id?: string | null;
  mechanic_id?: string | null;
  pickup_boy_id?: string | null;
  complaint_type: string;
  complaint_category?: string | null;
  severity?: string;
  priority?: string;
  description: string;
  customer_expected_resolution?: string | null;
  attachments?: string[];
}

export interface UpdateComplaintInput {
  status?: string;
  assigned_to?: string | null;
  acknowledged_by?: string | null;
  resolution?: string | null;
  resolution_action_taken?: string | null;
  resolved_by?: string | null;
  customer_satisfied?: boolean | null;
  customer_feedback?: string | null;
  refund_requested?: boolean;
  refund_issued?: boolean;
  refund_amount?: number;
  refund_reference?: string | null;
  compensation_provided?: string | null;
  escalated_to_level?: string | null;
  workshop_penalized?: boolean;
  penalty_amount?: number;
  penalty_reason?: string | null;
  follow_up_required?: boolean;
  follow_up_count?: number;
  closed_by?: string | null;
  closure_notes?: string | null;
  internal_notes?: string | null;
  tags?: string[];
}

// ============================================
// 2. FRAUD_CASES TABLE
// ============================================
export interface FraudCase {
  id: string;
  case_number: string; // NOT NULL UNIQUE
  case_type: string; // NOT NULL
  severity: string; // DEFAULT 'MEDIUM', CHECK (LOW, MEDIUM, HIGH, CRITICAL)
  workshop_id: string | null;
  user_id: string | null;
  lead_id: string | null;
  fraud_description: string; // NOT NULL
  evidence: Record<string, any>[]; // jsonb DEFAULT '[]'
  financial_impact: number; // DEFAULT 0
  affected_customers: Record<string, any>[]; // jsonb DEFAULT '[]'
  status: string; // DEFAULT 'REPORTED', CHECK (REPORTED, INVESTIGATING, CONFIRMED, FALSE_POSITIVE, RESOLVED, ESCALATED)
  investigator_id: string | null;
  investigation_notes: string | null;
  investigation_started_at: string | null;
  investigation_completed_at: string | null;
  actions_taken: Record<string, any>[]; // jsonb DEFAULT '[]'
  penalty_amount: number; // DEFAULT 0
  refund_issued: number; // DEFAULT 0
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  reported_by: string | null;
  reported_at: string; // DEFAULT now()
  created_at: string;
  updated_at: string;
}

export interface CreateFraudCaseInput {
  case_type: string;
  severity?: string;
  workshop_id?: string | null;
  user_id?: string | null;
  lead_id?: string | null;
  fraud_description: string;
  evidence?: Record<string, any>[];
  financial_impact?: number;
  affected_customers?: Record<string, any>[];
  reported_by?: string | null;
}

export interface UpdateFraudCaseInput {
  status?: string;
  investigator_id?: string | null;
  investigation_notes?: string | null;
  investigation_started_at?: string | null;
  investigation_completed_at?: string | null;
  actions_taken?: Record<string, any>[];
  penalty_amount?: number;
  refund_issued?: number;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Complaint Types
 */
export type ComplaintType =
  | 'POOR_SERVICE_QUALITY'
  | 'OVERCHARGING'
  | 'INCORRECT_PARTS'
  | 'DELAYED_SERVICE'
  | 'DAMAGED_VEHICLE'
  | 'RUDE_BEHAVIOR'
  | 'MISSING_ITEMS'
  | 'INCOMPLETE_WORK'
  | 'FAILED_PICKUP'
  | 'FAILED_DELIVERY'
  | 'OTHER';

/**
 * Complaint Categories
 */
export type ComplaintCategory =
  | 'SERVICE'
  | 'BILLING'
  | 'COMMUNICATION'
  | 'DELIVERY'
  | 'QUALITY'
  | 'BEHAVIOR';

/**
 * Complaint Severity
 */
export type ComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Complaint Priority
 */
export type ComplaintPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/**
 * Complaint Status
 */
export type ComplaintStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'ESCALATED';

/**
 * Fraud Case Types
 */
export type FraudCaseType =
  | 'PRICE_MANIPULATION'
  | 'FAKE_PARTS'
  | 'OVERBILLING'
  | 'KICKBACK'
  | 'FAKE_INVOICE'
  | 'IDENTITY_THEFT'
  | 'DATA_MANIPULATION'
  | 'COLLUSION'
  | 'MISREPRESENTATION'
  | 'OTHER';

/**
 * Fraud Severity
 */
export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Fraud Status
 */
export type FraudStatus =
  | 'REPORTED'
  | 'INVESTIGATING'
  | 'CONFIRMED'
  | 'FALSE_POSITIVE'
  | 'RESOLVED'
  | 'ESCALATED';

/**
 * Response types
 */
export interface ComplaintsResponse {
  complaints: CustomerComplaint[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FraudCasesResponse {
  cases: FraudCase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Filter types
 */
export interface ComplaintFilters {
  status?: string;
  severity?: string;
  priority?: string;
  complaint_type?: string;
  workshop_id?: string;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface FraudFilters {
  status?: string;
  severity?: string;
  case_type?: string;
  workshop_id?: string;
  investigator_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

