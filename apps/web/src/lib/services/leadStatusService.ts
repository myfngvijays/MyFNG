/**
 * Lead Status Workflow Service
 * Manages status transitions and validations
 * Task: WA-301
 */

import { createClient } from '../supabase/client';

/**
 * NOTE:
 * This project has multiple workflow phases and status enums have expanded over time
 * (QC/Billing/Invoice/Payment/Delivery/CSE/Audit).
 * To avoid UI breakage when new enum values are added in DB, we treat statuses as open strings
 * and provide labels/colors for known values.
 */
export type LeadStatus = string;

export type UserRole = string;

/**
 * Status Workflow Definition
 * 
 * Primary Flow:
 * NEW → ASSIGNED → ACCEPTED → IN_PROGRESS → READY_FOR_DELIVERY → DELIVERED → COMPLETED
 * 
 * Alternative Flows:
 * ASSIGNED → REJECTED (Workshop rejects)
 * Any status → CANCELLED (Admin cancels)
 */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  // Basic intake flow
  NEW: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  TEAM_ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],

  // Mechanic work
  IN_PROGRESS: ['WORK_COMPLETED', 'REWORK_REQUIRED', 'CANCELLED'],
  MECHANIC_WORKING: ['WORK_COMPLETED', 'REWORK_REQUIRED', 'CANCELLED'],
  REWORK_REQUIRED: ['IN_PROGRESS', 'WORK_COMPLETED', 'CANCELLED'],
  WORK_COMPLETED: ['QC_APPROVED', 'REWORK_REQUIRED', 'READY_FOR_BILLING'],
  QC_PENDING: ['QC_APPROVED', 'REWORK_REQUIRED'],
  QC_APPROVED: ['READY_FOR_BILLING', 'AUDIT_PENDING'],

  // Audit (optional)
  AUDIT_PENDING: ['AUDIT_APPROVED', 'AUDIT_FLAGGED'],
  AUDIT_APPROVED: ['READY_FOR_BILLING'],
  AUDIT_FLAGGED: ['REWORK_REQUIRED', 'IN_PROGRESS'],

  // Billing / Invoice / Payment
  READY_FOR_BILLING: ['INVOICE_GENERATED'],
  INVOICE_GENERATED: ['AWAITING_PAYMENT', 'READY_FOR_BILLING'],
  AWAITING_PAYMENT: ['PARTIAL_PAYMENT', 'PAID', 'COD_PENDING'],
  PARTIAL_PAYMENT: ['AWAITING_PAYMENT', 'PAID', 'COD_PENDING'],
  PAID: ['READY_FOR_DELIVERY'],
  COD_PENDING: ['READY_FOR_DELIVERY'],

  // Delivery
  READY_FOR_DELIVERY: ['DELIVERED_TO_CUSTOMER'],
  DELIVERED_TO_CUSTOMER: ['COMPLETED', 'COMPLAINT_OPENED'],

  // Post delivery / CSE
  COMPLAINT_OPENED: ['COMPLETED'],
  CUSTOMER_UNHAPPY: ['COMPLAINT_OPENED', 'COMPLETED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],

  // Legacy statuses
  DELIVERED: ['COMPLETED', 'READY_FOR_DELIVERY'],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Role-based permissions for status transitions
 */
const ROLE_PERMISSIONS: Record<string, { canTransitionFrom: string[]; canTransitionTo: string[] }> = {
  SUPER_ADMIN: {
    canTransitionFrom: ['*'],
    canTransitionTo: ['*'],
  },
  SUB_ADMIN: {
    canTransitionFrom: ['*'],
    canTransitionTo: ['*'],
  },
  LEAD_MANAGER: {
    canTransitionFrom: ['NEW'],
    canTransitionTo: ['ASSIGNED', 'CANCELLED'],
  },
  WORKSHOP_ADMIN: {
    canTransitionFrom: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'REWORK_REQUIRED', 'READY_FOR_DELIVERY'],
    canTransitionTo: ['ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'REWORK_REQUIRED', 'READY_FOR_DELIVERY', 'CANCELLED'],
  },
  WORKSHOP_SUPERVISOR: {
    canTransitionFrom: ['WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'REWORK_REQUIRED'],
    canTransitionTo: ['QC_APPROVED', 'REWORK_REQUIRED', 'READY_FOR_BILLING', 'AUDIT_PENDING'],
  },
  WORKSHOP_MECHANIC: {
    canTransitionFrom: ['IN_PROGRESS', 'MECHANIC_WORKING', 'REWORK_REQUIRED'],
    canTransitionTo: ['WORK_COMPLETED'],
  },
  WORKSHOP_PICKUP_BOY: {
    canTransitionFrom: ['READY_FOR_DELIVERY'],
    canTransitionTo: ['DELIVERED_TO_CUSTOMER'],
  },
  BILLING: {
    canTransitionFrom: ['READY_FOR_BILLING', 'INVOICE_GENERATED', 'AWAITING_PAYMENT'],
    canTransitionTo: ['INVOICE_GENERATED', 'AWAITING_PAYMENT', 'READY_FOR_DELIVERY', 'PARTIAL_PAYMENT', 'COD_PENDING'],
  },
  CSE: {
    canTransitionFrom: ['DELIVERED_TO_CUSTOMER', 'DELIVERED', 'COMPLAINT_OPENED'],
    canTransitionTo: ['COMPLETED', 'COMPLAINT_OPENED'],
  },
};

/**
 * Check if a status transition is valid
 */
export function canTransitionTo(
  currentStatus: LeadStatus,
  newStatus: LeadStatus,
  userRole: UserRole
): boolean {
  // Check if transition is allowed in workflow
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  if (allowedTransitions.length > 0 && !allowedTransitions.includes(newStatus)) return false;

  // Check if user role has permission
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (rolePermissions) {
    const anyFrom = rolePermissions.canTransitionFrom.includes('*');
    const anyTo = rolePermissions.canTransitionTo.includes('*');
    if (!anyFrom && !rolePermissions.canTransitionFrom.includes(currentStatus)) return false;
    if (!anyTo && !rolePermissions.canTransitionTo.includes(newStatus)) return false;
  }

  return true;
}

/**
 * Get available status transitions for current status and user role
 */
export function getAvailableTransitions(
  currentStatus: LeadStatus,
  userRole: UserRole
): LeadStatus[] {
  const workflowTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return workflowTransitions;

  const anyFrom = rolePermissions.canTransitionFrom.includes('*');
  const anyTo = rolePermissions.canTransitionTo.includes('*');
  if (!anyFrom && !rolePermissions.canTransitionFrom.includes(currentStatus)) return [];

  return workflowTransitions.filter((status) => anyTo || rolePermissions.canTransitionTo.includes(status));
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: LeadStatus): string {
  const labels: Record<string, string> = {
    NEW: 'New',
    ASSIGNED: 'Assigned to Workshop',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    IN_PROGRESS: 'In Progress',
    REWORK_REQUIRED: 'Rework Required',
    WORK_COMPLETED: 'Work Completed (QC Pending)',
    QC_PENDING: 'QC Pending',
    QC_APPROVED: 'QC Approved',
    READY_FOR_BILLING: 'Ready for Billing',
    INVOICE_GENERATED: 'Invoice Generated',
    AWAITING_PAYMENT: 'Awaiting Payment',
    PARTIAL_PAYMENT: 'Partial Payment',
    COD_PENDING: 'COD Pending',
    READY_FOR_DELIVERY: 'Ready for Delivery',
    DELIVERED_TO_CUSTOMER: 'Delivered to Customer',
    DELIVERED: 'Delivered (Legacy)',
    ON_HOLD: 'HOLD',
    COMPLAINT_OPENED: 'Complaint Opened',
    CUSTOMER_UNHAPPY: 'Customer Unhappy',
    COMPLETED: 'Completed',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || String(status).replace(/_/g, ' ');
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: LeadStatus): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    NEW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    ASSIGNED: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    ACCEPTED: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    REJECTED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    IN_PROGRESS: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    ON_HOLD: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    REWORK_REQUIRED: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    WORK_COMPLETED: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    QC_PENDING: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    QC_APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    READY_FOR_BILLING: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    INVOICE_GENERATED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    AWAITING_PAYMENT: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    READY_FOR_DELIVERY: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    DELIVERED_TO_CUSTOMER: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    COMPLAINT_OPENED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    CUSTOMER_UNHAPPY: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    COMPLETED: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    CLOSED: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  };
  return colors[status] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
}

/**
 * Get status icon for UI
 */
export function getStatusIcon(status: LeadStatus): string {
  const icons: Record<string, string> = {
    NEW: '🆕',
    ASSIGNED: '📋',
    ACCEPTED: '✅',
    REJECTED: '❌',
    IN_PROGRESS: '🔧',
    REWORK_REQUIRED: '🔁',
    WORK_COMPLETED: '🧾',
    QC_PENDING: '🧾',
    QC_APPROVED: '✅',
    READY_FOR_BILLING: '🧾',
    INVOICE_GENERATED: '📄',
    AWAITING_PAYMENT: '💳',
    READY_FOR_DELIVERY: '📦',
    DELIVERED_TO_CUSTOMER: '🚚',
    DELIVERED: '🚚',
    COMPLETED: '✔️',
    CLOSED: '🔒',
    CANCELLED: '🚫',
  };
  return icons[status] || '•';
}

/**
 * Validate status transition with detailed error message
 */
export function validateTransition(
  currentStatus: LeadStatus,
  newStatus: LeadStatus,
  userRole: UserRole
): { valid: boolean; error?: string } {
  // Check if same status
  if (currentStatus === newStatus) {
    return { valid: false, error: 'Lead is already in this status' };
  }

  // Check workflow validity
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  if (allowedTransitions.length > 0 && !allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${getStatusLabel(currentStatus)} to ${getStatusLabel(newStatus)}. Invalid workflow.`,
    };
  }

  // Check role permissions
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (rolePermissions) {
    const anyFrom = rolePermissions.canTransitionFrom.includes('*');
    const anyTo = rolePermissions.canTransitionTo.includes('*');
    if (!anyFrom && !rolePermissions.canTransitionFrom.includes(currentStatus)) {
      return {
        valid: false,
        error: `Your role (${userRole}) cannot modify leads with status ${getStatusLabel(currentStatus)}`,
      };
    }
    if (!anyTo && !rolePermissions.canTransitionTo.includes(newStatus)) {
      return {
        valid: false,
        error: `Your role (${userRole}) cannot set status to ${getStatusLabel(newStatus)}`,
      };
    }
  } else if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUB_ADMIN') {
    return {
      valid: false,
      error: `Your role (${userRole}) cannot modify leads with status ${getStatusLabel(currentStatus)}`,
    };
  }

  return { valid: true };
}

/**
 * Transition lead status with validation and logging
 */
export async function transitionStatus(
  leadId: string,
  newStatus: LeadStatus,
  userId: string,
  userRole: UserRole,
  notes?: string
): Promise<{ success: boolean; error?: string; lead?: any }> {
  const supabase = await createClient();

  try {
    // Get current lead
    const { data: lead, error: fetchError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchError || !lead) {
      return { success: false, error: 'Lead not found' };
    }

    const currentStatus = lead.status as LeadStatus;

    // Validate transition
    const validation = validateTransition(currentStatus, newStatus, userRole);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Prepare update data
    const now = new Date().toISOString();
    const updateData: any = {
      status: newStatus,
      updated_by_id: userId,
      updated_at: now,
    };

    // Add timestamp fields based on status
    switch (newStatus) {
      case 'ASSIGNED':
        updateData.assigned_at = now;
        break;
      case 'ACCEPTED':
        updateData.accepted_at = now;
        break;
      case 'REJECTED':
        updateData.rejected_at = now;
        break;
      case 'COMPLETED':
        updateData.completed_at = now;
        break;
      case 'CANCELLED':
        updateData.cancelled_at = now;
        break;
    }

    // Update lead status
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead status:', updateError);
      return { success: false, error: 'Failed to update lead status' };
    }

    // Create event log
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'STATUS_CHANGE',
      event_description: `Status changed from ${getStatusLabel(currentStatus)} to ${getStatusLabel(newStatus)}`,
      old_status: currentStatus,
      new_status: newStatus,
      event_data: notes ? { notes } : null,
      created_by: userId,
    });

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'UPDATE_LEAD_STATUS',
      table_name: 'service_leads',
      record_id: leadId,
      old_data: { status: currentStatus },
      new_data: { status: newStatus },
    });

    return { success: true, lead: updatedLead };
  } catch (error) {
    console.error('Error in transitionStatus:', error);
    return { success: false, error: 'Internal error during status transition' };
  }
}

/**
 * Get status workflow timeline
 */
export function getStatusTimeline(lead: any): {
  status: LeadStatus;
  label: string;
  timestamp?: string;
  completed: boolean;
}[] {
  const timeline: {
    status: LeadStatus;
    label: string;
    timestamp?: string;
    completed: boolean;
  }[] = [
    {
      status: 'NEW',
      label: 'Created',
      timestamp: lead.created_at,
      completed: true,
    },
    {
      status: 'ASSIGNED',
      label: 'Assigned to Workshop',
      timestamp: lead.assigned_at,
      completed: !!lead.assigned_at,
    },
    {
      status: 'ACCEPTED',
      label: 'Accepted',
      timestamp: lead.accepted_at,
      completed: !!lead.accepted_at,
    },
    {
      status: 'IN_PROGRESS',
      label: 'Work Started',
      timestamp: undefined, // Would need a new field
      completed: ['IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(lead.status),
    },
    {
      status: 'READY_FOR_DELIVERY',
      label: 'Ready for Delivery',
      timestamp: undefined,
      completed: ['READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(lead.status),
    },
    {
      status: 'DELIVERED',
      label: 'Delivered',
      timestamp: undefined,
      completed: ['DELIVERED', 'COMPLETED'].includes(lead.status),
    },
    {
      status: 'COMPLETED',
      label: 'Completed',
      timestamp: lead.completed_at,
      completed: lead.status === 'COMPLETED',
    },
  ];

  return timeline;
}

/**
 * Check if lead can be edited
 */
export function canEditLead(_status: LeadStatus): boolean {
  return true;
}

/**
 * Check if lead can be cancelled
 */
export function canCancelLead(status: LeadStatus, userRole: UserRole): boolean {
  if (['COMPLETED', 'CANCELLED'].includes(status)) {
    return false;
  }
  
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.canTransitionTo.includes('CANCELLED');
}

/**
 * Get next recommended status
 */
export function getNextStatus(currentStatus: LeadStatus): LeadStatus | null {
  const workflowOrder: LeadStatus[] = [
    'NEW',
    'ASSIGNED',
    'ACCEPTED',
    'IN_PROGRESS',
    'READY_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED',
  ];

  const currentIndex = workflowOrder.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === workflowOrder.length - 1) {
    return null;
  }

  return workflowOrder[currentIndex + 1];
}

