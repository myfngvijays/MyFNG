/**
 * SLA Timer Service - Mobile
 * Handles Service Level Agreement tracking for leads
 * Task: WA-102
 */

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
  percentage: number;
}

// SLA Configuration (in minutes)
const SLA_CONFIG = {
  NORMAL: {
    accept: 20,
    assign: 30,
    start: 120,
  },
  RSA: {
    accept: 10,
    assign: 15,
    start: 30,
  },
  HOME_SERVICE: {
    accept: 30,
    assign: 60,
    start: 180,
  },
};

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

  if (assignedAt) {
    deadlines.accept = new Date(assignedAt.getTime() + config.accept * 60000);
  }

  if (acceptedAt) {
    deadlines.assign = new Date(acceptedAt.getTime() + config.assign * 60000);
    deadlines.start = new Date(acceptedAt.getTime() + config.start * 60000);
  }

  return deadlines;
}

export function checkSLAStatus(
  deadline: Date | null,
  completedAt?: Date | null
): SLAStatus {
  if (!deadline) return 'ON_TIME';
  
  const now = completedAt ? new Date(completedAt) : new Date();
  const timeUntilDeadline = deadline.getTime() - now.getTime();
  const minutesRemaining = timeUntilDeadline / (1000 * 60);

  if (minutesRemaining < 0) {
    return 'BREACHED';
  }

  const config = SLA_CONFIG.NORMAL;
  const totalMinutes = config.accept;
  const percentageElapsed = ((totalMinutes - minutesRemaining) / totalMinutes) * 100;

  if (percentageElapsed > 70) {
    return 'AT_RISK';
  }

  return 'ON_TIME';
}

export function getTimeRemaining(
  deadline: Date | null,
  leadType: 'NORMAL' | 'RSA' | 'HOME_SERVICE' = 'NORMAL'
): SLATimeRemaining | null {
  if (!deadline) return null;

  const now = new Date();
  const timeUntilDeadline = deadline.getTime() - now.getTime();
  
  const totalMinutes = Math.floor(timeUntilDeadline / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((timeUntilDeadline / 1000) % 60);

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

export function getSLAColor(status: SLAStatus): string {
  switch (status) {
    case 'ON_TIME':
      return '#10B981';
    case 'AT_RISK':
      return '#F59E0B';
    case 'BREACHED':
      return '#EF4444';
    default:
      return '#6B7280';
  }
}

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
  if (lead.status === 'COMPLETED' || lead.status === 'CANCELLED') {
    if (lead.sla_accept_deadline && lead.accepted_at) {
      const acceptStatus = checkSLAStatus(
        new Date(lead.sla_accept_deadline),
        new Date(lead.accepted_at)
      );
      if (acceptStatus === 'BREACHED') return 'BREACHED';
    }
    return 'ON_TIME';
  }

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
 * Legacy helpers (some older screens expect these names)
 */
export function getSLAStatusColor(status: SLAStatus): string {
  return getSLAColor(status);
}

export function calculateSLA(
  createdAt: string,
  status: string,
  leadType: 'NORMAL' | 'RSA' | 'HOME_SERVICE' = 'NORMAL'
): { timeRemaining: SLATimeRemaining | null; slaStatus: SLAStatus } {
  // For a simple mobile badge, we treat "createdAt + accept SLA" as the main deadline.
  const created = new Date(createdAt);
  const cfg = SLA_CONFIG[leadType] || SLA_CONFIG.NORMAL;
  const deadline = new Date(created.getTime() + cfg.accept * 60_000);
  const timeRemaining = getTimeRemaining(deadline, leadType);

  // If lead is completed/cancelled, SLA is considered on time for display (unless explicitly breached elsewhere).
  const normalizedStatus = String(status || '').toUpperCase();
  const slaStatus: SLAStatus =
    normalizedStatus === 'COMPLETED' || normalizedStatus === 'CANCELLED'
      ? 'ON_TIME'
      : checkSLAStatus(deadline);

  return { timeRemaining, slaStatus };
}

