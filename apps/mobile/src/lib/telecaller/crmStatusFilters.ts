/** One Fresh + one Follow-up in the queue dropdown (matches lead detail picker). */
export function mergeCrmStatusFilters(
  rows: Array<{ id?: string; code?: string; label?: string; name?: string }>,
  allLabel = 'Lead Status',
): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [
    { id: 'all', label: allLabel },
    { id: 'new', label: 'Fresh' },
    { id: 'interested', label: 'Interested' },
    { id: 'will_visit', label: 'He will visit' },
    { id: 'callback', label: 'Follow-up' },
    { id: 'booking_confirmed', label: 'Booking confirmed' },
    { id: 'in_service', label: 'In Service' },
    { id: 'service_done', label: 'Service Done' },
    { id: 'lost', label: 'Lost' },
  ];
  const skipIds = new Set([
    'all',
    'fresh',
    'new',
    'incomplete',
    'ringing',
    'ringing_no_answer',
    'callback',
    'follow_up',
    'followup',
    'interested',
    'will_visit',
    'booking_confirmed',
    'in_service',
    'service_done',
    'lost',
  ]);
  const seenLabels = new Set(out.map((r) => r.label.toLowerCase()));

  const normalizeLabel = (id: string, raw: string) => {
    if (
      id === 'callback' ||
      id === 'follow_up' ||
      id === 'followup' ||
      /^callback$/i.test(raw)
    ) {
      return 'Follow-up';
    }
    return String(raw || '').trim() || id;
  };

  for (const r of rows) {
    const id = String(r.id || r.code || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!id || skipIds.has(id)) continue;
    const label = normalizeLabel(id, String(r.label || r.name || r.code || id));
    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) continue;
    skipIds.add(id);
    seenLabels.add(labelKey);
    out.push({ id, label });
  }
  return out;
}
