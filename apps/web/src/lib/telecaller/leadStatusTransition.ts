/**
 * Mirrors the DB trigger prevent_status_overwrite_after_completion (database/83_…sql):
 * once a lead is COMPLETED or further down the workshop pipeline, its status can only move forward.
 * The CRM uses this to skip an impossible status write instead of failing the whole save.
 */
const LOCKED_FORWARD: Record<string, string[]> = {
  COMPLETED: ['COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  WORK_COMPLETED: ['COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  QC_PENDING: ['COMPLETED', 'WORK_COMPLETED', 'QC_PENDING', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  QC_APPROVED: ['QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  READY_FOR_BILLING: ['READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  READY_FOR_DELIVERY: ['READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'],
  DELIVERED: ['DELIVERED', 'CLOSED'],
  CLOSED: ['CLOSED'],
};

export function leadStatusChangeAllowed(from: unknown, to: unknown): boolean {
  const a = String(from || '').trim().toUpperCase();
  const b = String(to || '').trim().toUpperCase();
  if (!b || a === b) return true;
  const allowed = LOCKED_FORWARD[a];
  return !allowed || allowed.includes(b);
}
