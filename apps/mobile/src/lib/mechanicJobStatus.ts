/** Display / filter status — partial checklist counts as in progress. */
export function resolveMechanicDisplayStatus(
  mechanicStatus: string | undefined,
  checklistDone = 0,
  checklistTotal = 0,
): string {
  const st = String(mechanicStatus || 'ASSIGNED').toUpperCase();
  if (['COMPLETED', 'HOLD', 'WAITING_APPROVAL', 'READY_FOR_DELIVERY'].includes(st)) {
    return st;
  }
  if (st === 'IN_PROGRESS') return 'IN_PROGRESS';
  const done = Number(checklistDone) || 0;
  const total = Number(checklistTotal) || 0;
  if (total > 0 && done > 0 && done < total) return 'IN_PROGRESS';
  return st || 'ASSIGNED';
}

export function isMechanicJobInProgress(
  mechanicStatus: string | undefined,
  checklistDone = 0,
  checklistTotal = 0,
): boolean {
  return resolveMechanicDisplayStatus(mechanicStatus, checklistDone, checklistTotal) === 'IN_PROGRESS';
}

export function mechanicStatusLabel(status: string): string {
  const s = String(status || 'ASSIGNED').toUpperCase();
  if (s === 'IN_PROGRESS') return 'In Progress';
  if (s === 'WAITING_APPROVAL') return 'Need Approval';
  if (s === 'READY_FOR_DELIVERY') return 'Ready';
  return s.replace(/_/g, ' ');
}

export function mechanicStatusColors(status: string): { bg: string; fg: string } {
  const s = String(status || '').toUpperCase();
  if (s === 'IN_PROGRESS') return { bg: '#DBEAFE', fg: '#1D4ED8' };
  if (s === 'ASSIGNED') return { bg: '#D1FAE5', fg: '#047857' };
  if (s === 'HOLD' || s === 'WAITING_APPROVAL') return { bg: '#FEF3C7', fg: '#B45309' };
  if (s === 'COMPLETED') return { bg: '#EDE9FE', fg: '#6D28D9' };
  return { bg: '#E2E8F0', fg: '#475569' };
}
