/**
 * SLA Timer Service
 * Handles Service Level Agreement tracking for leads
 * Task: WA-102
 */

import { createClient } from '../supabase/client';

export interface SLADeadlines {
  accept: Date | null;
  assign: Date | null;
  start: Date | null;
}

export type SLAStatus = 'ON_TIME' | 'AT_RISK' | 'BREACHED';

export interface SLATimeRemaining {
  minutes: number;
  seconds: number;
  hours: number;
  status: SLAStatus;
  percentage: number; // 0-100, how much time has elapsed
}

/**
 * SLA Configuration (in minutes)
 * Adjust these values based on business requirements
 */
const SLA_CONFIG = {
  NORMAL: {
    accept: 20,      // 20 minutes to accept lead
    assign: 30,      // 30 minutes to assign mechanic after acceptance
    start: 120,      // 2 hours to start repair after acceptance
  },
  RSA: {
    accept: 10,      // 10 minutes for RSA (urgent)
    assign: 15,      // 15 minutes to assign
    start: 30,       // 30 minutes to start
  },
  HOME_SERVICE: {
    accept: 30,      // 30 minutes for home service
    assign: 60,      // 1 hour to assign
    start: 180,      // 3 hours to start
  },
};

/**
 * Calculate SLA deadlines based on lead creation/assignment time
 */
export function calculateSLADeadlines(
  leadType: 'NORMAL' | 'RSA' | 'HOME_SERVICE',
  assignedAt: Date,
  acceptedAt?: Date
): SLADeadlines {
  const config = SLA_CONFIG[leadType];
  
  const deadlines: SLADeadlines = {
    accept: null,
    assign: null,
    start: null,
  };

  // Accept deadline (from assignment time)
  if (assignedAt) {
    deadlines.accept = new Date(assignedAt.getTime() + config.accept * 60000);
  }

  // Assign and start deadlines (from acceptance time)
  if (acceptedAt) {
    deadlines.assign = new Date(acceptedAt.getTime() + config.assign * 60000);
    deadlines.start = new Date(acceptedAt.getTime() + config.start * 60000);
  }

  return deadlines;
}

/**
 * Check current SLA status for a deadline
 */
export function checkSLAStatus(
  deadline: Date | null,
  completedAt?: Date | null
): SLAStatus {
  if (!deadline) return 'ON_TIME';
  
  const now = completedAt ? new Date(completedAt) : new Date();
  const timeUntilDeadline = deadline.getTime() - now.getTime();
  const minutesRemaining = timeUntilDeadline / (1000 * 60);

  // If already past deadline
  if (minutesRemaining < 0) {
    return 'BREACHED';
  }

  // Get lead type config (assume NORMAL for default)
  const config = SLA_CONFIG.NORMAL;
  const totalMinutes = config.accept; // Use accept as reference
  
  // Calculate percentage of time elapsed
  const percentageElapsed = ((totalMinutes - minutesRemaining) / totalMinutes) * 100;

  // AT_RISK if more than 70% of time has elapsed
  if (percentageElapsed > 70) {
    return 'AT_RISK';
  }

  return 'ON_TIME';
}

/**
 * Get time remaining until deadline with detailed breakdown
 */
export function getTimeRemaining(
  deadline: Date | null,
  leadType: 'NORMAL' | 'RSA' | 'HOME_SERVICE' = 'NORMAL'
): SLATimeRemaining | null {
  if (!deadline) return null;

  const now = new Date();
  const timeUntilDeadline = deadline.getTime() - now.getTime();
  
  // Calculate time components
  const totalMinutes = Math.floor(timeUntilDeadline / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((timeUntilDeadline / 1000) % 60);

  // Get config for percentage calculation
  const config = SLA_CONFIG[leadType];
  const totalSLAMinutes = config.accept;
  const elapsedMinutes = totalSLAMinutes - totalMinutes;
  const percentage = Math.min(100, Math.max(0, (elapsedMinutes / totalSLAMinutes) * 100));

  return {
    minutes: Math.max(0, minutes),
    seconds: Math.max(0, seconds),
    hours: Math.max(0, hours),
    status: checkSLAStatus(deadline),
    percentage,
  };
}

/**
 * Format time remaining as string (e.g., "5 mins", "1h 30m", "Breached")
 */
export function formatTimeRemaining(timeRemaining: SLATimeRemaining | null): string {
  if (!timeRemaining) return 'N/A';

  if (timeRemaining.status === 'BREACHED') {
    return 'Breached';
  }

  const { hours, minutes } = timeRemaining;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes} mins`;
  }

  return '< 1 min';
}

/**
 * Get SLA color code for UI indicators
 */
export function getSLAColor(status: SLAStatus): string {
  switch (status) {
    case 'ON_TIME':
      return '#10B981'; // green
    case 'AT_RISK':
      return '#F59E0B'; // yellow/amber
    case 'BREACHED':
      return '#EF4444'; // red
    default:
      return '#6B7280'; // gray
  }
}

/**
 * Get SLA background color for badges
 */
export function getSLABackgroundColor(status: SLAStatus): string {
  switch (status) {
    case 'ON_TIME':
      return '#D1FAE5'; // light green
    case 'AT_RISK':
      return '#FEF3C7'; // light yellow
    case 'BREACHED':
      return '#FEE2E2'; // light red
    default:
      return '#F3F4F6'; // light gray
  }
}

/**
 * Calculate overall SLA status for a lead
 */
export function calculateLeadSLAStatus(lead: {
  status: string;
  assigned_at: string | null;
  accepted_at: string | null;
  sla_accept_deadline: string | null;
  sla_assign_deadline: string | null;
  sla_start_deadline: string | null;
  assigned_mechanic_id: string | null;
  lead_type: 'NORMAL' | 'RSA' | 'HOME_SERVICE';
}): SLAStatus {
  // If lead is completed or cancelled, check if it was on time
  if (lead.status === 'COMPLETED' || lead.status === 'CANCELLED') {
    // Check if any deadline was breached during the process
    if (lead.sla_accept_deadline && lead.accepted_at) {
      const acceptStatus = checkSLAStatus(
        new Date(lead.sla_accept_deadline),
        new Date(lead.accepted_at)
      );
      if (acceptStatus === 'BREACHED') return 'BREACHED';
    }
    return 'ON_TIME';
  }

  // For active leads, check current applicable deadline
  if (lead.status === 'ASSIGNED' && lead.sla_accept_deadline) {
    return checkSLAStatus(new Date(lead.sla_accept_deadline));
  }

  if (lead.status === 'ACCEPTED') {
    if (!lead.assigned_mechanic_id && lead.sla_assign_deadline) {
      return checkSLAStatus(new Date(lead.sla_assign_deadline));
    }
    if (lead.sla_start_deadline) {
      return checkSLAStatus(new Date(lead.sla_start_deadline));
    }
  }

  return 'ON_TIME';
}

/**
 * Update SLA status for all active leads in the database
 * This should be called periodically (e.g., every minute via cron job)
 */
export async function updateAllSLAStatuses(): Promise<void> {
  const supabase = await createClient();

  try {
    // Get all active leads with SLA tracking
    const { data: leads, error } = await supabase
      .from('service_leads')
      .select('id, status, lead_type, assigned_at, accepted_at, sla_accept_deadline, sla_assign_deadline, sla_start_deadline, assigned_mechanic_id, sla_status')
      .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'])
      .not('sla_accept_deadline', 'is', null);

    if (error) {
      console.error('Error fetching leads for SLA update:', error);
      return;
    }

    if (!leads || leads.length === 0) return;

    // Update each lead's SLA status
    for (const lead of leads) {
      const slaStatus = calculateLeadSLAStatus(lead as any);
      
      // Only update if status has changed
      if (lead.sla_status !== slaStatus) {
        await supabase
          .from('service_leads')
          .update({ sla_status: slaStatus })
          .eq('id', lead.id);
      }
    }

    console.log(`Updated SLA status for ${leads.length} leads`);
  } catch (error) {
    console.error('Error updating SLA statuses:', error);
  }
}

/**
 * Get time since creation (for "7 minutes ago" display)
 */
export function getTimeSince(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
}

/**
 * Check if SLA will be breached soon (within warning threshold)
 */
export function isNearingDeadline(
  deadline: Date | null,
  warningMinutes: number = 5
): boolean {
  if (!deadline) return false;

  const now = new Date();
  const timeUntilDeadline = deadline.getTime() - now.getTime();
  const minutesRemaining = timeUntilDeadline / (1000 * 60);

  return minutesRemaining > 0 && minutesRemaining <= warningMinutes;
}

/**
 * Get all SLA details for a lead (for detailed view)
 */
export function getLeadSLADetails(lead: {
  lead_type: 'NORMAL' | 'RSA' | 'HOME_SERVICE';
  assigned_at: string | null;
  accepted_at: string | null;
  sla_accept_deadline: string | null;
  sla_assign_deadline: string | null;
  sla_start_deadline: string | null;
}) {
  return {
    acceptDeadline: lead.sla_accept_deadline ? new Date(lead.sla_accept_deadline) : null,
    assignDeadline: lead.sla_assign_deadline ? new Date(lead.sla_assign_deadline) : null,
    startDeadline: lead.sla_start_deadline ? new Date(lead.sla_start_deadline) : null,
    acceptTimeRemaining: lead.sla_accept_deadline 
      ? getTimeRemaining(new Date(lead.sla_accept_deadline), lead.lead_type)
      : null,
    assignTimeRemaining: lead.sla_assign_deadline
      ? getTimeRemaining(new Date(lead.sla_assign_deadline), lead.lead_type)
      : null,
    startTimeRemaining: lead.sla_start_deadline
      ? getTimeRemaining(new Date(lead.sla_start_deadline), lead.lead_type)
      : null,
  };
}

