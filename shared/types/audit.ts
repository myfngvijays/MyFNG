/**
 * Audit & Logging System Types
 * Phase 7A Implementation
 * Matching EXACT database schema
 */

// ============================================
// 1. AUDIT_LOGS TABLE
// ============================================
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string; // NOT NULL
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, any> | null; // jsonb
  new_data: Record<string, any> | null; // jsonb
  ip_address: string | null;
  user_agent: string | null;
  created_at: string; // timestamp with time zone
  // Enhanced fields for tech audit
  action_category?: string | null; // SECURITY, DATA, CONFIG, API, ERROR, etc.
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  session_id?: string | null;
  api_endpoint?: string | null;
  http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | null;
  response_status?: number | null;
  execution_time_ms?: number | null;
  error_message?: string | null;
  error_stack?: string | null;
  request_id?: string | null;
  compliance_flags?: Record<string, any> | null; // jsonb
  data_hash?: string | null;
  is_tamper_proof?: boolean | null;
  retention_until?: string | null;
}

export interface CreateAuditLogInput {
  user_id?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  // Enhanced fields
  action_category?: string | null;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  session_id?: string | null;
  api_endpoint?: string | null;
  http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | null;
  response_status?: number | null;
  execution_time_ms?: number | null;
  error_message?: string | null;
  error_stack?: string | null;
  request_id?: string | null;
  compliance_flags?: Record<string, any> | null;
  data_hash?: string | null;
  is_tamper_proof?: boolean | null;
  retention_until?: string | null;
}

// ============================================
// 2. LEAD_STATUS_HISTORY TABLE
// ============================================
export interface LeadStatusHistory {
  id: string;
  lead_id: string; // NOT NULL
  old_status: string | null;
  new_status: string; // NOT NULL
  changed_by: string | null;
  changed_at: string; // timestamp with time zone, DEFAULT now()
  reason: string | null;
  notes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>; // jsonb, DEFAULT '{}'
}

export interface CreateLeadStatusHistoryInput {
  lead_id: string;
  old_status?: string | null;
  new_status: string;
  changed_by?: string | null;
  reason?: string | null;
  notes?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any>;
}

// ============================================
// 3. LEAD_ACTIVITIES TABLE
// ============================================
export interface LeadActivity {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  activity_type: string; // NOT NULL
  description: string | null;
  old_status: string | null; // USER-DEFINED (lead_status enum)
  new_status: string | null; // USER-DEFINED (lead_status enum)
  metadata: Record<string, any> | null; // jsonb
  created_at: string; // timestamp with time zone
}

export interface CreateLeadActivityInput {
  lead_id?: string | null;
  user_id?: string | null;
  activity_type: string;
  description?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  metadata?: Record<string, any> | null;
}

// ============================================
// 4. LEAD_EVENTS TABLE
// ============================================
export interface LeadEvent {
  id: string;
  lead_id: string; // NOT NULL
  event_type: string; // NOT NULL
  event_description: string | null;
  event_data: Record<string, any> | null; // jsonb
  old_status: string | null;
  new_status: string | null;
  created_by: string | null;
  created_at: string; // timestamp with time zone
}

export interface CreateLeadEventInput {
  lead_id: string;
  event_type: string;
  event_description?: string | null;
  event_data?: Record<string, any> | null;
  old_status?: string | null;
  new_status?: string | null;
  created_by?: string | null;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Common activity types for lead_activities
 */
export type LeadActivityType =
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED_TO_WORKSHOP'
  | 'TEAM_ASSIGNED'
  | 'MECHANIC_STARTED'
  | 'MECHANIC_COMPLETED'
  | 'QC_APPROVED'
  | 'QC_REJECTED'
  | 'INVOICE_GENERATED'
  | 'PAYMENT_RECEIVED'
  | 'LEAD_CLOSED'
  | 'COMMENT_ADDED'
  | 'FILE_UPLOADED'
  | 'LEAD_REOPENED'
  | 'LEAD_CANCELLED';

/**
 * Common event types for lead_events
 */
export type LeadEventType =
  | 'TELECALLER_CREATED'
  | 'VALIDATED_BY_LEAD_MANAGER'
  | 'MARKED_INCOMPLETE'
  | 'ASSIGNED_TO_WORKSHOP'
  | 'WORKSHOP_ACCEPTED'
  | 'WORKSHOP_REJECTED'
  | 'TEAM_ASSIGNED'
  | 'PICKUP_SCHEDULED'
  | 'PICKUP_STARTED'
  | 'PICKUP_COMPLETED'
  | 'WORK_STARTED'
  | 'EXTRA_WORK_REQUESTED'
  | 'EXTRA_WORK_APPROVED'
  | 'EXTRA_WORK_REJECTED'
  | 'WORK_COMPLETED'
  | 'QC_PENDING'
  | 'QC_APPROVED'
  | 'QC_REJECTED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_SENT'
  | 'PAYMENT_RECEIVED'
  | 'CSE_FOLLOWUP_SCHEDULED'
  | 'CSE_FOLLOWUP_COMPLETED'
  | 'LEAD_CLOSED'
  | 'LEAD_CANCELLED'
  | 'REFUND_REQUESTED'
  | 'COMPLAINT_FILED'
  | 'AUDIT_PERFORMED';

/**
 * Common audit actions for audit_logs
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'ROLE_CHANGE'
  | 'PERMISSIONS_UPDATED'
  | 'STATUS_CHANGE'
  | 'ASSIGNMENT'
  | 'APPROVAL'
  | 'REJECTION'
  | 'EXPORT'
  | 'IMPORT'
  | 'BULK_UPDATE'
  | 'SETTINGS_CHANGE';

/**
 * Response type for paginated audit logs
 */
export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// SECURITY EVENTS TYPES
// ============================================

export interface SecurityEvent {
  id: string;
  event_type: SecurityEventType;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  event_details: Record<string, any>; // jsonb
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface CreateSecurityEventInput {
  event_type: SecurityEventType;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  event_details?: Record<string, any>;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export type SecurityEventType =
  | 'FAILED_LOGIN'
  | 'PERMISSION_DENIED'
  | 'RLS_VIOLATION'
  | 'SUSPICIOUS_ACTIVITY'
  | 'UNAUTHORIZED_ACCESS'
  | 'BRUTE_FORCE_ATTEMPT'
  | 'SQL_INJECTION_ATTEMPT'
  | 'XSS_ATTEMPT'
  | 'CSRF_ATTEMPT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_TOKEN'
  | 'SESSION_HIJACK'
  | 'DATA_BREACH_ATTEMPT'
  | 'CONFIGURATION_CHANGE'
  | 'PRIVILEGE_ESCALATION';

// ============================================
// API REQUEST LOGS TYPES
// ============================================

export interface ApiRequestLog {
  id: string;
  request_id: string;
  user_id: string | null;
  api_endpoint: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  request_body: Record<string, any> | null; // jsonb
  response_status: number | null;
  response_body: Record<string, any> | null; // jsonb
  execution_time_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  created_at: string;
}

export interface CreateApiRequestLogInput {
  request_id?: string;
  user_id?: string | null;
  api_endpoint: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  request_body?: Record<string, any> | null;
  response_status?: number | null;
  response_body?: Record<string, any> | null;
  execution_time_ms?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
}

// ============================================
// SYSTEM CONFIG CHANGES TYPES
// ============================================

export interface SystemConfigChange {
  id: string;
  config_key: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  change_reason: string | null;
  approved_by: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface CreateSystemConfigChangeInput {
  config_key: string;
  old_value?: string | null;
  new_value?: string | null;
  changed_by?: string | null;
  change_reason?: string | null;
  approved_by?: string | null;
  ip_address?: string | null;
}

/**
 * Response type for lead history (status + activities + events)
 */
export interface LeadHistoryResponse {
  lead_id: string;
  status_history: LeadStatusHistory[];
  activities: LeadActivity[];
  events: LeadEvent[];
}

/**
 * Filters for audit log queries
 */
export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  table_name?: string;
  record_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

/**
 * Filters for lead history queries
 */
export interface LeadHistoryFilters {
  lead_id: string;
  activity_type?: string;
  event_type?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

