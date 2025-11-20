/**
 * Workshop Compliance Types
 * Phase 7H Implementation - EXACT schema match
 */

// ============================================
// 1. WORKSHOP_AUDITS TABLE
// ============================================
export interface WorkshopAudit {
  id: string;
  workshop_id: string; // NOT NULL
  auditor_id: string; // NOT NULL
  audit_type: string; // NOT NULL (USER-DEFINED: audit_type)
  audit_status: string; // DEFAULT 'SCHEDULED' (USER-DEFINED: audit_status)
  scheduled_date: string; // date, NOT NULL
  scheduled_time: string | null; // time without time zone
  actual_start_time: string | null;
  actual_end_time: string | null;
  duration_minutes: number | null;
  overall_score: number; // DEFAULT 0
  max_score: number; // DEFAULT 100
  score_percentage: number; // DEFAULT 0
  audit_grade: string | null; // USER-DEFINED: audit_grade
  infrastructure_score: number; // DEFAULT 0
  equipment_score: number; // DEFAULT 0
  staff_qualification_score: number; // DEFAULT 0
  safety_compliance_score: number; // DEFAULT 0
  customer_service_score: number; // DEFAULT 0
  work_quality_score: number; // DEFAULT 0
  documentation_score: number; // DEFAULT 0
  cleanliness_score: number; // DEFAULT 0
  strengths: string | null;
  weaknesses: string | null;
  recommendations: string | null;
  critical_issues: string[]; // ARRAY
  action_items: string[]; // ARRAY
  license_verified: boolean; // DEFAULT false
  insurance_verified: boolean; // DEFAULT false
  safety_certifications_verified: boolean; // DEFAULT false
  equipment_calibration_verified: boolean; // DEFAULT false
  requires_follow_up: boolean; // DEFAULT false
  follow_up_date: string | null; // date
  follow_up_audit_id: string | null;
  follow_up_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  auditor_remarks: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 2. WORKSHOP_CERTIFICATIONS TABLE
// ============================================
export interface WorkshopCertification {
  id: string;
  workshop_id: string; // NOT NULL
  certification_type: string; // NOT NULL
  certification_name: string; // NOT NULL
  issuing_authority: string | null;
  issue_date: string | null; // date
  expiry_date: string | null; // date
  is_valid: boolean; // DEFAULT true
  verification_status: string; // DEFAULT 'PENDING' (USER-DEFINED: verification_status)
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  document_url: string | null;
  document_number: string | null;
  renewal_required: boolean; // DEFAULT false
  renewal_reminder_sent: boolean; // DEFAULT false
  renewal_reminder_date: string | null; // date
  created_at: string;
  updated_at: string;
}

// ============================================
// 3. WORKSHOP_COMPLIANCE_HISTORY TABLE
// ============================================
export interface WorkshopComplianceHistory {
  id: string;
  workshop_id: string; // NOT NULL
  snapshot_date: string; // date, NOT NULL
  overall_compliance_score: number; // DEFAULT 0
  audit_grade: string | null; // USER-DEFINED: audit_grade
  valid_certifications: number; // DEFAULT 0
  expired_certifications: number; // DEFAULT 0
  pending_certifications: number; // DEFAULT 0
  open_action_items: number; // DEFAULT 0
  overdue_action_items: number; // DEFAULT 0
  compliance_status: string; // DEFAULT 'COMPLIANT'
  recorded_by: string | null;
  created_at: string;
}

// ============================================
// 4. AUDIT_CHECKLIST_ITEMS TABLE
// ============================================
export interface AuditChecklistItem {
  id: string;
  audit_id: string; // NOT NULL
  category: string; // NOT NULL
  item_name: string; // NOT NULL
  item_description: string | null;
  max_points: number; // DEFAULT 10
  points_awarded: number; // DEFAULT 0
  status: string; // DEFAULT 'PENDING' (USER-DEFINED: verification_status)
  is_critical: boolean; // DEFAULT false
  is_mandatory: boolean; // DEFAULT true
  auditor_notes: string | null;
  evidence_photos: string[]; // ARRAY
  issues_found: string | null;
  checked_at: string | null;
  created_at: string;
}

// ============================================
// 5. AUDIT_ACTION_ITEMS TABLE
// ============================================
export interface AuditActionItem {
  id: string;
  audit_id: string; // NOT NULL
  workshop_id: string; // NOT NULL
  action_title: string; // NOT NULL
  action_description: string; // NOT NULL
  priority: string; // DEFAULT 'MEDIUM'
  category: string | null;
  assigned_to: string | null;
  assigned_by: string; // NOT NULL
  assigned_at: string; // DEFAULT now()
  due_date: string | null; // date
  is_overdue: boolean; // DEFAULT false
  status: string; // DEFAULT 'OPEN'
  completion_date: string | null;
  verification_date: string | null;
  verified_by: string | null;
  completion_notes: string | null;
  evidence_urls: string[]; // ARRAY
  created_at: string;
  updated_at: string;
}

// ============================================
// 6. AUDIT_MEDIA TABLE
// ============================================
export interface AuditMedia {
  id: string;
  audit_id: string; // NOT NULL
  media_type: string; // NOT NULL
  media_url: string; // NOT NULL
  thumbnail_url: string | null;
  category: string; // NOT NULL
  title: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  uploaded_by: string; // NOT NULL
  uploaded_at: string; // DEFAULT now()
}

// ============================================
// 7. AUDIT_TEMPLATES TABLE
// ============================================
export interface AuditTemplate {
  id: string;
  template_name: string; // NOT NULL
  template_description: string | null;
  audit_type: string; // NOT NULL (USER-DEFINED: audit_type)
  checklist_items: Record<string, any>[]; // jsonb DEFAULT '[]'
  category_weights: Record<string, any>; // jsonb DEFAULT '{}'
  is_active: boolean; // DEFAULT true
  version: number; // DEFAULT 1
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 8. AUDITOR_PERFORMANCE_METRICS TABLE
// (Already defined in metrics.ts as part of Phase 7D)
// ============================================

// INPUT TYPES
export interface CreateWorkshopAuditInput {
  workshop_id: string;
  auditor_id: string;
  audit_type: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  notes?: string | null;
}

export interface UpdateWorkshopAuditInput {
  audit_status?: string;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  overall_score?: number;
  audit_grade?: string | null;
  infrastructure_score?: number;
  equipment_score?: number;
  staff_qualification_score?: number;
  safety_compliance_score?: number;
  customer_service_score?: number;
  work_quality_score?: number;
  documentation_score?: number;
  cleanliness_score?: number;
  strengths?: string | null;
  weaknesses?: string | null;
  recommendations?: string | null;
  critical_issues?: string[];
  action_items?: string[];
  auditor_remarks?: string | null;
}

export interface CreateCertificationInput {
  workshop_id: string;
  certification_type: string;
  certification_name: string;
  issuing_authority?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  document_url?: string | null;
  document_number?: string | null;
}

export interface CreateChecklistItemInput {
  audit_id: string;
  category: string;
  item_name: string;
  item_description?: string | null;
  max_points?: number;
  is_critical?: boolean;
  is_mandatory?: boolean;
}

export interface CreateActionItemInput {
  audit_id: string;
  workshop_id: string;
  action_title: string;
  action_description: string;
  priority?: string;
  category?: string | null;
  assigned_to?: string | null;
  assigned_by: string;
  due_date?: string | null;
}

export interface CreateAuditMediaInput {
  audit_id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string | null;
  category: string;
  title?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  uploaded_by: string;
}

export interface CreateAuditTemplateInput {
  template_name: string;
  template_description?: string | null;
  audit_type: string;
  checklist_items?: Record<string, any>[];
  category_weights?: Record<string, any>;
  created_by?: string | null;
}

// UTILITY TYPES
export type AuditType = 'QUALITY' | 'COMPLIANCE' | 'SAFETY' | 'INFRASTRUCTURE' | 'FINANCIAL';
export type AuditStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
export type AuditGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type ActionItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActionItemStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'VERIFIED';
export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'UNDER_REVIEW';

export interface WorkshopAuditWithDetails extends WorkshopAudit {
  checklist_items: AuditChecklistItem[];
  action_items: AuditActionItem[];
  media: AuditMedia[];
}

