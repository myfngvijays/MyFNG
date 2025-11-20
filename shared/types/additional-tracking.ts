/**
 * Additional Tracking Types
 * Phase 7I Implementation - EXACT schema match
 */

// ============================================
// 1. LEAD_MEDIA TABLE
// ============================================
export interface LeadMedia {
  id: string;
  lead_id: string; // NOT NULL
  media_type: string; // NOT NULL
  file_url: string; // NOT NULL
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  category: string | null;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  is_deleted: boolean; // DEFAULT false
}

// ============================================
// 2. LEAD_UPDATES TABLE
// ============================================
export interface LeadUpdate {
  id: string;
  lead_id: string; // NOT NULL
  updated_by: string; // NOT NULL
  update_type: string; // NOT NULL
  message: string | null;
  created_at: string;
}

// ============================================
// 3. MECHANIC_ASSIGNMENTS TABLE
// ============================================
export interface MechanicAssignment {
  id: string;
  lead_id: string; // NOT NULL
  mechanic_id: string; // NOT NULL
  assigned_by: string; // NOT NULL
  assigned_at: string; // DEFAULT now()
  reassigned_from: string | null;
  reassignment_reason: string | null;
  assignment_notes: string | null;
  status: string; // DEFAULT 'ACTIVE'
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 4. SUPERVISOR_ACTIONS TABLE
// ============================================
export interface SupervisorAction {
  id: string;
  lead_id: string; // NOT NULL
  supervisor_id: string; // NOT NULL
  action_type: string; // NOT NULL
  action_data: Record<string, any> | null; // jsonb
  notes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// 5. BILLING_TEAM_ACTIONS TABLE
// ============================================
export interface BillingTeamAction {
  id: string;
  lead_id: string; // NOT NULL
  invoice_id: string | null;
  billing_member_id: string; // NOT NULL
  action_type: string; // NOT NULL
  action_description: string | null;
  previous_amount: number | null;
  new_amount: number | null;
  revision_reason: string | null;
  invoice_sent_via: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  sent_at: string | null;
  customer_viewed: boolean; // DEFAULT false
  customer_viewed_at: string | null;
  customer_downloaded: boolean; // DEFAULT false
  customer_downloaded_at: string | null;
  payment_link: string | null;
  payment_link_clicked: boolean; // DEFAULT false
  payment_link_clicked_at: string | null;
  reminder_count: number; // DEFAULT 0
  last_reminder_at: string | null;
  notes: string | null;
  metadata: Record<string, any>; // jsonb DEFAULT '{}'
  created_at: string;
}

// ============================================
// 6. QC_CHECKS TABLE
// ============================================
export interface QCCheck {
  id: string;
  lead_id: string; // NOT NULL
  supervisor_id: string; // NOT NULL
  qc_status: string; // DEFAULT 'PENDING'
  images_verified: boolean; // DEFAULT false
  parts_verified: boolean; // DEFAULT false
  mechanic_notes_approved: boolean; // DEFAULT false
  checklist_data: Record<string, boolean>; // jsonb DEFAULT {...}
  supervisor_notes: string | null;
  failed_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 7. AUDITS TABLE (Quality Audits)
// ============================================
export interface Audit {
  id: string;
  lead_id: string; // NOT NULL
  auditor_id: string | null;
  audit_type: string; // DEFAULT 'QUALITY'
  score: number | null; // CHECK (score >= 0 AND score <= 5)
  remarks: string | null;
  status: string; // DEFAULT 'PENDING'
  audit_date: string | null;
  created_at: string;
  updated_at: string;
}

// INPUT TYPES
export interface CreateLeadMediaInput {
  lead_id: string;
  media_type: string;
  file_url: string;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by?: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
  title?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateLeadUpdateInput {
  lead_id: string;
  updated_by: string;
  update_type: string;
  message?: string | null;
}

export interface CreateMechanicAssignmentInput {
  lead_id: string;
  mechanic_id: string;
  assigned_by: string;
  reassigned_from?: string | null;
  reassignment_reason?: string | null;
  assignment_notes?: string | null;
}

export interface CreateSupervisorActionInput {
  lead_id: string;
  supervisor_id: string;
  action_type: string;
  action_data?: Record<string, any> | null;
  notes?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface CreateBillingActionInput {
  lead_id: string;
  invoice_id?: string | null;
  billing_member_id: string;
  action_type: string;
  action_description?: string | null;
  previous_amount?: number | null;
  new_amount?: number | null;
  revision_reason?: string | null;
}

export interface CreateQCCheckInput {
  lead_id: string;
  supervisor_id: string;
  qc_status?: string;
  images_verified?: boolean;
  parts_verified?: boolean;
  mechanic_notes_approved?: boolean;
  checklist_data?: Record<string, boolean>;
  supervisor_notes?: string | null;
  failed_reason?: string | null;
}

export interface CreateAuditInput {
  lead_id: string;
  auditor_id?: string | null;
  audit_type?: string;
  score?: number | null;
  remarks?: string | null;
  status?: string;
  audit_date?: string | null;
}

// UTILITY TYPES
export type MediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
export type MediaCategory = 'BEFORE' | 'AFTER' | 'PROGRESS' | 'INVOICE' | 'RECEIPT' | 'OTHER';
export type UpdateType = 'STATUS_CHANGE' | 'COMMENT' | 'SYSTEM_UPDATE' | 'MANUAL_UPDATE';
export type AssignmentStatus = 'ACTIVE' | 'COMPLETED' | 'REASSIGNED' | 'CANCELLED';
export type QCStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'RECHECK_REQUIRED';
export type AuditType = 'QUALITY' | 'SAFETY' | 'COMPLIANCE';
export type AuditStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

