const KPI_KEYS = [
  'total_leads',
  'new_leads',
  'incomplete',
  'interested',
  'will_visit',
  'callbacks',
  'booking_confirmed',
  'in_service',
  'service_done',
  'lost',
  'today_calls',
  'followups_today',
  'reminders_pending',
];

export function dashboardKpisHaveSignal(kpis: Record<string, unknown> | null | undefined): boolean {
  if (!kpis) return false;
  return KPI_KEYS.some((key) => Number(kpis[key] || 0) > 0);
}

export function shouldKeepPreviousDashboardKpis(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
  nextFreshCount = 0,
): boolean {
  if (!prev || !dashboardKpisHaveSignal(prev)) return false;
  if (!next) return true;
  return !dashboardKpisHaveSignal(next) && nextFreshCount === 0;
}
