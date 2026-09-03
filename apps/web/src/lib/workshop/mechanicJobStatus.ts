/** Display / filter status — partial checklist counts as in progress. */
export function resolveMechanicDisplayStatus(
  mechanicStatus: string | undefined,
  checklistDone = 0,
  checklistTotal = 0,
  hasPendingExtraWork = false,
): string {
  const st = String(mechanicStatus || 'ASSIGNED').toUpperCase();
  if (hasPendingExtraWork && !['COMPLETED', 'READY_FOR_DELIVERY'].includes(st)) {
    return 'WAITING_APPROVAL';
  }
  if (['COMPLETED', 'HOLD', 'WAITING_APPROVAL', 'READY_FOR_DELIVERY'].includes(st)) {
    return st;
  }
  if (st === 'IN_PROGRESS') return 'IN_PROGRESS';
  const done = Number(checklistDone) || 0;
  const total = Number(checklistTotal) || 0;
  if (total > 0 && done > 0 && done < total) return 'IN_PROGRESS';
  return st || 'ASSIGNED';
}

export function isMechanicJobFinished(mechanicStatus: string | undefined): boolean {
  const st = String(mechanicStatus || '').toUpperCase();
  return st === 'COMPLETED' || st === 'READY_FOR_DELIVERY';
}

export function isMechanicJobInProgress(
  mechanicStatus: string | undefined,
  checklistDone = 0,
  checklistTotal = 0,
): boolean {
  return resolveMechanicDisplayStatus(mechanicStatus, checklistDone, checklistTotal) === 'IN_PROGRESS';
}
