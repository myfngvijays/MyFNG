/**
 * Lead Status Workflow Service
 * Manages status transitions and validations
 * Task: WA-301
 */

import { createClient } from '../supabase/client';

export type LeadStatus = 
  | 'NEW' 
  | 'ASSIGNED' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'IN_PROGRESS' 
  | 'READY_FOR_DELIVERY' 
  | 'DELIVERED' 
  | 'COMPLETED' 
  | 'CANCELLED';

export type UserRole = 
  | 'SUPER_ADMIN'
  | 'SUB_ADMIN'
  | 'LEAD_MANAGER'
  | 'WORKSHOP_ADMIN'
  | 'WORKSHOP_SUPERVISOR'
  | 'WORKSHOP_MECHANIC'
  | 'WORKSHOP_PICKUP_BOY';

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
const STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  REJECTED: [], // Terminal state for workshop
  IN_PROGRESS: ['READY_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['DELIVERED', 'IN_PROGRESS'], // Can go back if issue found
  DELIVERED: ['COMPLETED', 'READY_FOR_DELIVERY'], // Can go back if customer not satisfied
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Role-based permissions for status transitions
 */
const ROLE_PERMISSIONS: Record<UserRole, {
  canTransitionFrom: LeadStatus[];
  canTransitionTo: LeadStatus[];
}> = {
  SUPER_ADMIN: {
    canTransitionFrom: ['NEW', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'],
    canTransitionTo: ['ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
  },
  SUB_ADMIN: {
    canTransitionFrom: ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'],
    canTransitionTo: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
  },
  LEAD_MANAGER: {
    canTransitionFrom: ['NEW'],
    canTransitionTo: ['ASSIGNED', 'CANCELLED'],
  },
  WORKSHOP_ADMIN: {
    canTransitionFrom: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'],
    canTransitionTo: ['ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'CANCELLED'],
  },
  WORKSHOP_SUPERVISOR: {
    canTransitionFrom: ['ACCEPTED', 'IN_PROGRESS'],
    canTransitionTo: ['IN_PROGRESS', 'READY_FOR_DELIVERY'],
  },
  WORKSHOP_MECHANIC: {
    canTransitionFrom: ['IN_PROGRESS'],
    canTransitionTo: ['READY_FOR_DELIVERY'],
  },
  WORKSHOP_PICKUP_BOY: {
    canTransitionFrom: ['READY_FOR_DELIVERY'],
    canTransitionTo: ['DELIVERED'],
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
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions.includes(newStatus)) {
    return false;
  }

  // Check if user role has permission
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions.canTransitionFrom.includes(currentStatus)) {
    return false;
  }
  if (!rolePermissions.canTransitionTo.includes(newStatus)) {
    return false;
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

  // Filter by role permissions
  return workflowTransitions.filter(status => 
    rolePermissions.canTransitionFrom.includes(currentStatus) &&
    rolePermissions.canTransitionTo.includes(status)
  );
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    NEW: 'New',
    ASSIGNED: 'Assigned to Workshop',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    IN_PROGRESS: 'In Progress',
    READY_FOR_DELIVERY: 'Ready for Delivery',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: LeadStatus): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<LeadStatus, { bg: string; text: string; border: string }> = {
    NEW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    ASSIGNED: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    ACCEPTED: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    REJECTED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    IN_PROGRESS: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    READY_FOR_DELIVERY: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    DELIVERED: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    COMPLETED: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  };
  return colors[status] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
}

/**
 * Get status icon for UI
 */
export function getStatusIcon(status: LeadStatus): string {
  const icons: Record<LeadStatus, string> = {
    NEW: '🆕',
    ASSIGNED: '📋',
    ACCEPTED: '✅',
    REJECTED: '❌',
    IN_PROGRESS: '🔧',
    READY_FOR_DELIVERY: '📦',
    DELIVERED: '🚚',
    COMPLETED: '✔️',
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
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${getStatusLabel(currentStatus)} to ${getStatusLabel(newStatus)}. Invalid workflow.`,
    };
  }

  // Check role permissions
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions.canTransitionFrom.includes(currentStatus)) {
    return {
      valid: false,
      error: `Your role (${userRole}) cannot modify leads with status ${getStatusLabel(currentStatus)}`,
    };
  }
  if (!rolePermissions.canTransitionTo.includes(newStatus)) {
    return {
      valid: false,
      error: `Your role (${userRole}) cannot set status to ${getStatusLabel(newStatus)}`,
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
  const supabase = createClient();

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
export function canEditLead(status: LeadStatus): boolean {
  return !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(status);
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

