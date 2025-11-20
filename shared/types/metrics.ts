/**
 * Performance Metrics Types
 * Phase 7D Implementation - EXACT schema match
 */

// ============================================
// 1. TELECALLER_PERFORMANCE_METRICS TABLE
// ============================================
export interface TelecallerPerformanceMetrics {
  id: string;
  telecaller_id: string; // NOT NULL
  date: string; // date, NOT NULL
  total_calls: number; // DEFAULT 0
  answered_calls: number; // DEFAULT 0
  missed_calls: number; // DEFAULT 0
  call_duration_total: number; // DEFAULT 0
  avg_call_duration: number | null;
  leads_created: number; // DEFAULT 0
  leads_completed: number; // DEFAULT 0
  leads_followed_up: number; // DEFAULT 0
  incomplete_leads_converted: number; // DEFAULT 0
  call_to_lead_conversion_rate: number; // DEFAULT 0
  follow_up_success_rate: number; // DEFAULT 0
  duplicate_leads_created: number; // DEFAULT 0
  missed_follow_ups: number; // DEFAULT 0
  customer_complaints: number; // DEFAULT 0
  accuracy_score: number; // DEFAULT 0
  customer_rejected: number; // DEFAULT 0
  customer_not_responding: number; // DEFAULT 0
  wrong_numbers: number; // DEFAULT 0
  created_at: string;
  updated_at: string;
}

// ============================================
// 2. CSE_PERFORMANCE_METRICS TABLE
// ============================================
export interface CSEPerformanceMetrics {
  id: string;
  cse_id: string; // NOT NULL
  date: string; // date, NOT NULL
  total_followups_scheduled: number; // DEFAULT 0
  total_followups_completed: number; // DEFAULT 0
  followups_pending: number; // DEFAULT 0
  followups_overdue: number; // DEFAULT 0
  avg_call_duration: number; // DEFAULT 0
  total_call_time: number; // DEFAULT 0
  leads_closed: number; // DEFAULT 0
  complaints_resolved: number; // DEFAULT 0
  escalations_handled: number; // DEFAULT 0
  avg_satisfaction_score: number; // DEFAULT 0
  customers_highly_satisfied: number; // DEFAULT 0
  customers_dissatisfied: number; // DEFAULT 0
  positive_feedback_count: number; // DEFAULT 0
  negative_feedback_count: number; // DEFAULT 0
  issue_resolution_rate: number; // DEFAULT 0
  first_call_resolution_rate: number; // DEFAULT 0
  customer_retention_rate: number; // DEFAULT 0
  upsell_opportunities_identified: number; // DEFAULT 0
  refunds_processed: number; // DEFAULT 0
  compensation_issued: number; // DEFAULT 0
  created_at: string;
  updated_at: string;
}

// ============================================
// 3. PICKUP_BOY_METRICS TABLE
// ============================================
export interface PickupBoyMetrics {
  id: string;
  pickup_boy_id: string; // NOT NULL
  date: string; // date, NOT NULL
  total_pickups: number; // DEFAULT 0
  completed_pickups: number; // DEFAULT 0
  failed_pickups: number; // DEFAULT 0
  total_drops: number; // DEFAULT 0
  completed_drops: number; // DEFAULT 0
  failed_drops: number; // DEFAULT 0
  avg_pickup_time: number | null;
  avg_drop_time: number | null;
  punctuality_score: number | null;
  otp_success_rate: number | null;
  photo_compliance_rate: number | null;
  customer_complaints: number; // DEFAULT 0
  distance_traveled: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 4. AUDITOR_PERFORMANCE_METRICS TABLE
// ============================================
export interface AuditorPerformanceMetrics {
  id: string;
  auditor_id: string; // NOT NULL
  date: string; // date, NOT NULL
  audits_scheduled: number; // DEFAULT 0
  audits_completed: number; // DEFAULT 0
  audits_cancelled: number; // DEFAULT 0
  audits_in_progress: number; // DEFAULT 0
  avg_audit_duration: number | null;
  total_audit_time: number | null;
  workshops_passed: number; // DEFAULT 0
  workshops_failed: number; // DEFAULT 0
  follow_ups_required: number; // DEFAULT 0
  critical_issues_identified: number; // DEFAULT 0
  action_items_created: number; // DEFAULT 0
  action_items_verified: number; // DEFAULT 0
  audits_per_day: number; // DEFAULT 0
  completion_rate: number; // DEFAULT 0
  created_at: string;
  updated_at: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export type MetricsDateRange = {
  start_date: string;
  end_date: string;
};

export interface TelecallerMetricsReport {
  telecaller_id: string;
  telecaller_name?: string;
  period: MetricsDateRange;
  metrics: TelecallerPerformanceMetrics[];
  summary: {
    total_calls: number;
    total_leads_created: number;
    avg_conversion_rate: number;
    avg_accuracy_score: number;
  };
}

export interface CSEMetricsReport {
  cse_id: string;
  cse_name?: string;
  period: MetricsDateRange;
  metrics: CSEPerformanceMetrics[];
  summary: {
    total_followups: number;
    total_leads_closed: number;
    avg_satisfaction_score: number;
    resolution_rate: number;
  };
}

export interface PickupBoyMetricsReport {
  pickup_boy_id: string;
  pickup_boy_name?: string;
  period: MetricsDateRange;
  metrics: PickupBoyMetrics[];
  summary: {
    total_tasks: number;
    completion_rate: number;
    avg_punctuality_score: number;
    total_distance: number;
  };
}

export interface AuditorMetricsReport {
  auditor_id: string;
  auditor_name?: string;
  period: MetricsDateRange;
  metrics: AuditorPerformanceMetrics[];
  summary: {
    total_audits: number;
    completion_rate: number;
    avg_score: number;
    critical_issues: number;
  };
}

