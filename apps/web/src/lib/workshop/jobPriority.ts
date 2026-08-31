export type MechanicJobPriority = 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

/** Map service_leads.priority / lead_priority to mechanic_jobs.job_priority enum. */
export function mapLeadPriorityToJobPriority(
  priority?: string | null,
  leadPriority?: string | null,
): MechanicJobPriority {
  const raw = String(priority || leadPriority || 'NORMAL').toUpperCase();
  switch (raw) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'URGENT':
      return 'URGENT';
    case 'HIGH':
      return 'HIGH';
    case 'LOW':
    case 'MEDIUM':
    case 'NORMAL':
    default:
      return 'NORMAL';
  }
}
