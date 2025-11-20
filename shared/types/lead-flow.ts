/**
 * ================================================================
 * 🚀 LEAD FLOW - COMPLETE TYPE DEFINITIONS
 * ================================================================
 * Updated types for the complete 12-step lead flow
 * Includes all new statuses, CSE, Lead Manager, and Billing fields
 * ================================================================
 */

// ================================================================
// LEAD STATUS - All Possible Values
// ================================================================

export type LeadStatus =
  // Initial stages
  | 'NEW'                      // Lead just created
  | 'INCOMPLETE'               // Missing information
  
  // Lead Manager stages
  | 'VALIDATED'                // ✨ NEW - Lead Manager validated
  | 'ASSIGNED_TO_WORKSHOP'     // ✨ NEW - Workshop assigned by Lead Manager
  
  // Workshop stages
  | 'ACCEPTED'                 // Workshop accepted
  | 'REJECTED'                 // Workshop rejected
  | 'IN_PROGRESS'              // Work in progress
  | 'MECHANIC_WORKING'         // ✨ NEW - Mechanic actively working
  
  // QC stages
  | 'AWAITING_QC'              // ✨ NEW - Waiting for quality check
  | 'QC_APPROVED'              // ✨ NEW - QC passed
  | 'QC_FAILED'                // ✨ NEW - QC failed, rework needed
  
  // Billing stages
  | 'READY_FOR_BILLING'        // ✨ NEW - Ready for invoice
  | 'INVOICE_GENERATED'        // ✨ NEW - Invoice created
  
  // Payment stages
  | 'PAYMENT_PENDING'          // Waiting for payment
  | 'PAID'                     // Payment received
  
  // Delivery stages
  | 'AWAITING_DELIVERY'        // ✨ NEW - Waiting for vehicle pickup/delivery
  | 'COMPLETED'                // Service completed
  
  // Final stages
  | 'CLOSED'                   // ✨ NEW - Fully closed by CSE
  | 'CANCELLED';               // Cancelled

// ================================================================
// EXTENDED SERVICE LEAD INTERFACE
// ================================================================

export interface ServiceLead {
  // Basic Information
  id: string;
  lead_number: string;
  lead_type: 'NORMAL' | 'EMERGENCY' | 'VIP' | 'CORPORATE';
  status: LeadStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  
  // Customer Information
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  customer_alternate_phone?: string;
  customer_preferred_contact?: 'PHONE' | 'EMAIL' | 'WHATSAPP';
  customer_special_notes?: string;
  
  // Vehicle Information
  vehicle_number: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_variant?: string;
  vehicle_vin?: string;
  vehicle_fuel_type?: string;
  vehicle_odometer?: number;
  
  // Service Information
  service_type: string;
  service_type_ids?: string | string[]; // JSON or array
  subservice_ids?: string | string[]; // JSON or array
  description?: string;
  problem_description?: string;
  
  // Location
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location_latitude?: number;
  location_longitude?: number;
  
  // Pricing
  estimated_amount?: number;
  estimated_cost?: number;
  actual_amount?: number;
  final_amount?: number;
  total_price?: number;
  discount_amount?: number;
  tax_amount?: number;
  
  // ================================================================
  // ✨ NEW: LEAD MANAGER FIELDS
  // ================================================================
  validated_by_id?: string;
  validated_at?: string;
  validation_notes?: string;
  lead_manager_assigned_id?: string;
  lead_manager_assigned_at?: string;
  
  // ================================================================
  // ✨ NEW: WORKSHOP ASSIGNMENT TRACKING
  // ================================================================
  workshop_id?: string;
  assigned_to_workshop_at?: string;
  workshop_accepted_by?: string;
  assigned_by_workshop_admin_id?: string;
  
  // Workshop Actions
  assigned_to_id?: string;
  assigned_at?: string;
  accepted_at?: string;
  declined_at?: string;
  rejected_at?: string;
  rejected_reason?: string;
  rejection_notes?: string;
  
  // ================================================================
  // MECHANIC ASSIGNMENT
  // ================================================================
  assigned_mechanic_id?: string;
  mechanic_assigned_at?: string;
  mechanic_started_at?: string;      // ✨ NEW
  mechanic_completed_at?: string;    // ✨ NEW
  
  // ================================================================
  // SUPERVISOR & QC
  // ================================================================
  assigned_supervisor_id?: string;
  supervisor_assigned_at?: string;
  qc_status?: 'PENDING' | 'PASSED' | 'FAILED' | 'NOT_REQUIRED';
  qc_performed_by?: string;
  qc_performed_at?: string;
  qc_notes?: string;
  ready_for_delivery_at?: string;
  marked_ready_by?: string;
  
  // ================================================================
  // ✨ NEW: AUDIT TRACKING
  // ================================================================
  audit_required?: boolean;
  audit_status?: string;
  audit_remarks?: string;
  audit_performed_by?: string;
  audit_performed_at?: string;
  
  // ================================================================
  // ✨ NEW: BILLING & INVOICE FIELDS
  // ================================================================
  invoice_id?: string;
  invoice_number?: string;
  invoice_amount?: number;
  invoice_generated_by?: string;
  invoice_generated_at?: string;
  invoice_sent_at?: string;
  
  // ================================================================
  // PAYMENT INFORMATION
  // ================================================================
  payment_mode?: 'CASH' | 'ONLINE' | 'UPI' | 'CARD' | 'WALLET' | 'PREPAID' | 'POSTPAID';
  payment_status?: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL';
  payment_txn_id?: string;
  payment_collected_by?: string;     // ✨ NEW
  payment_collected_at?: string;     // ✨ NEW
  
  // ================================================================
  // PICKUP & DELIVERY
  // ================================================================
  pickup_required?: boolean;
  pickup_address?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_otp?: string;
  assigned_pickup_boy_id?: string;
  assigned_pickup_id?: string;
  pickup_assigned_at?: string;
  pickup_status?: 'NOT_ASSIGNED' | 'ASSIGNED' | 'EN_ROUTE' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  
  // Preferred Schedule
  preferred_date?: string;
  preferred_time_slot?: string;
  preferred_slot_start?: string;
  preferred_slot_end?: string;
  
  // ================================================================
  // ✨ NEW: CSE (CUSTOMER SERVICE EXECUTIVE) FIELDS
  // ================================================================
  cse_assigned_id?: string;
  cse_assigned_at?: string;
  cse_followup_completed?: boolean;
  cse_followup_notes?: string;
  customer_satisfaction_score?: number; // 1-5
  final_closure_at?: string;
  closed_by?: string;
  
  // ================================================================
  // TELECALLER FIELDS
  // ================================================================
  assigned_telecaller_id?: string;
  telecaller_assigned_at?: string;
  is_incomplete?: boolean;
  incomplete_reason?: string;
  last_call_at?: string;
  total_calls?: number;
  follow_up_required?: boolean;
  next_follow_up_at?: string;
  
  // ================================================================
  // SLA TRACKING
  // ================================================================
  sla_accept_deadline?: string;
  sla_assign_deadline?: string;
  sla_start_deadline?: string;
  sla_expires_at?: string;
  sla_status?: 'ON_TIME' | 'WARNING' | 'BREACHED';
  sla_state?: 'ON_TIME' | 'AT_RISK' | 'BREACHED';
  
  // ================================================================
  // METADATA
  // ================================================================
  notes?: string;
  internal_notes?: string;
  notes_internal?: string;
  attachments?: any;
  meta?: any;
  
  // Job Card
  job_card_number?: string;
  distance_from_workshop?: number;
  
  // Miscellaneous
  created_from?: 'WEB' | 'MOBILE' | 'TELECALLER' | 'API';
  lead_priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  city_id?: string;
  model_id?: string;
  assigned_by?: string;
  contact_method?: 'CALL' | 'SMS' | 'EMAIL' | 'WHATSAPP';
  coupon_code?: string;
  reopen_count?: number;
  escalation?: boolean;
  
  // Timestamps
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Created/Updated By
  created_by_id?: string;
  updated_by_id?: string;
}

// ================================================================
// ✨ NEW: CSE FOLLOW-UP INTERFACE
// ================================================================

export interface CSEFollowup {
  id: string;
  lead_id: string;
  cse_id: string;
  followup_type: 'POST_SERVICE' | 'COMPLAINT' | 'SATISFACTION_CHECK' | 'ESCALATION';
  
  // Schedule
  scheduled_time?: string;
  completed_at?: string;
  
  // Customer Response
  customer_response?: string;
  satisfaction_score?: number; // 1-5
  service_quality_rating?: number; // 1-5
  workshop_rating?: number; // 1-5
  pickup_rating?: number; // 1-5
  price_rating?: number; // 1-5
  
  // Issues & Resolution
  issues_reported?: string;
  issue_category?: 'QUALITY' | 'PRICING' | 'DELAY' | 'BEHAVIOR' | 'OTHER';
  resolution_provided?: string;
  resolution_status?: 'PENDING' | 'RESOLVED' | 'ESCALATED' | 'NO_ACTION_NEEDED';
  
  // Escalation
  escalated: boolean;
  escalated_to?: string;
  escalation_reason?: string;
  escalated_at?: string;
  
  // Feedback
  would_recommend?: boolean;
  feedback_text?: string;
  
  // Call Details
  call_duration?: number; // in seconds
  call_recording_url?: string;
  
  // Notes
  notes?: string;
  internal_remarks?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ================================================================
// ✨ NEW: CUSTOMER COMPLAINT INTERFACE
// ================================================================

export interface CustomerComplaint {
  id: string;
  complaint_number: string;
  
  // Related Entities
  lead_id?: string;
  customer_id?: string;
  workshop_id?: string;
  mechanic_id?: string;
  pickup_boy_id?: string;
  
  // Complaint Details
  complaint_type: 'SERVICE' | 'BILLING' | 'BEHAVIOR' | 'DELAY' | 'DAMAGE' | 'OTHER';
  complaint_category?: 'SERVICE_QUALITY' | 'PRICING_DISPUTE' | 'STAFF_BEHAVIOR' | 'DELIVERY_DELAY' | 'VEHICLE_DAMAGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  description: string;
  customer_expected_resolution?: string;
  attachments?: string[]; // Array of URLs
  
  // Status
  status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ESCALATED' | 'REJECTED';
  
  // Assignment
  assigned_to?: string;
  assigned_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  
  // Resolution
  resolution?: string;
  resolution_action_taken?: string;
  resolved_by?: string;
  resolved_at?: string;
  customer_satisfied?: boolean;
  customer_feedback?: string;
  
  // Refund
  refund_requested: boolean;
  refund_issued: boolean;
  refund_amount?: number;
  refund_reference?: string;
  compensation_provided?: string;
  
  // Escalation
  escalated_to_level?: 'SUPERVISOR' | 'MANAGER' | 'SENIOR_MANAGEMENT' | 'LEGAL';
  escalated_at?: string;
  
  // Penalties
  workshop_penalized: boolean;
  penalty_amount?: number;
  penalty_reason?: string;
  
  // Follow-up
  follow_up_required: boolean;
  follow_up_count: number;
  last_follow_up_at?: string;
  
  // Closure
  closed_by?: string;
  closed_at?: string;
  closure_notes?: string;
  
  // Internal
  internal_notes?: string;
  tags?: string[];
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ================================================================
// ✨ NEW: BILLING TEAM ACTION INTERFACE
// ================================================================

export interface BillingTeamAction {
  id: string;
  lead_id: string;
  invoice_id?: string;
  billing_member_id: string;
  
  // Action Details
  action_type: 'GENERATED' | 'SENT' | 'REVISED' | 'CANCELLED' | 'PAYMENT_RECEIVED' | 'REMINDER_SENT';
  action_description?: string;
  
  // Revision Details
  previous_amount?: number;
  new_amount?: number;
  revision_reason?: string;
  
  // Sending Details
  invoice_sent_via?: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PDF' | 'IN_APP';
  recipient_phone?: string;
  recipient_email?: string;
  sent_at?: string;
  
  // Customer Interaction
  customer_viewed: boolean;
  customer_viewed_at?: string;
  customer_downloaded: boolean;
  customer_downloaded_at?: string;
  
  // Payment Link
  payment_link?: string;
  payment_link_clicked: boolean;
  payment_link_clicked_at?: string;
  
  // Reminders
  reminder_count: number;
  last_reminder_at?: string;
  
  // Metadata
  notes?: string;
  metadata?: any;
  
  // Timestamp
  created_at: string;
}

// ================================================================
// LEAD FLOW DASHBOARD VIEW INTERFACE
// ================================================================

export interface LeadFlowDashboard {
  // Basic Info
  id: string;
  lead_number: string;
  status: LeadStatus;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  created_at: string;
  
  // Lead Manager
  lead_manager_assigned_id?: string;
  lead_manager_name?: string;
  validated_by_id?: string;
  validated_by_name?: string;
  validated_at?: string;
  
  // Workshop
  workshop_id?: string;
  workshop_name?: string;
  assigned_to_workshop_at?: string;
  workshop_accepted_by?: string;
  workshop_accepted_by_name?: string;
  accepted_at?: string;
  
  // Mechanic
  assigned_mechanic_id?: string;
  mechanic_name?: string;
  mechanic_started_at?: string;
  mechanic_completed_at?: string;
  
  // Supervisor
  assigned_supervisor_id?: string;
  supervisor_name?: string;
  
  // QC
  qc_status?: string;
  qc_performed_by?: string;
  qc_performed_by_name?: string;
  qc_performed_at?: string;
  
  // Auditor
  audit_performed_by?: string;
  auditor_name?: string;
  audit_performed_at?: string;
  
  // Billing
  invoice_generated_by?: string;
  billing_member_name?: string;
  invoice_generated_at?: string;
  invoice_sent_at?: string;
  
  // Payment
  payment_status?: string;
  payment_mode?: string;
  payment_collected_by?: string;
  payment_collected_by_name?: string;
  payment_collected_at?: string;
  
  // CSE
  cse_assigned_id?: string;
  cse_name?: string;
  cse_assigned_at?: string;
  cse_followup_completed?: boolean;
  customer_satisfaction_score?: number;
  
  // Closure
  completed_at?: string;
  closed_by?: string;
  closed_by_name?: string;
  final_closure_at?: string;
  
  // SLA
  sla_status?: string;
  sla_expires_at?: string;
}

// ================================================================
// HELPER TYPES
// ================================================================

export type LeadStage = 
  | 'CREATION'
  | 'VALIDATION'
  | 'ASSIGNMENT'
  | 'WORKSHOP'
  | 'SERVICE'
  | 'QC'
  | 'BILLING'
  | 'PAYMENT'
  | 'DELIVERY'
  | 'CSE'
  | 'CLOSURE';

export interface LeadStatusTransition {
  from: LeadStatus;
  to: LeadStatus;
  allowed_roles: string[];
  requires_fields?: string[];
}

// ================================================================
// EXPORT ALL
// ================================================================

export type {
  LeadStatus,
  ServiceLead,
  CSEFollowup,
  CustomerComplaint,
  BillingTeamAction,
  LeadFlowDashboard,
  LeadStage,
  LeadStatusTransition,
};

