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

/** Idle/auth failures often return HTTP 200 with every KPI = 0. Keep the last good payload. */
export function shouldKeepPreviousDashboard(
  prev: { kpis?: Record<string, unknown>; fresh_leads?: unknown[] } | null | undefined,
  next: { kpis?: Record<string, unknown>; fresh_leads?: unknown[] } | null | undefined,
): boolean {
  if (!prev?.kpis || !dashboardKpisHaveSignal(prev.kpis)) return false;
  if (!next?.kpis) return true;
  const nextFresh = Array.isArray(next.fresh_leads) ? next.fresh_leads.length : 0;
  return !dashboardKpisHaveSignal(next.kpis) && nextFresh === 0;
}
