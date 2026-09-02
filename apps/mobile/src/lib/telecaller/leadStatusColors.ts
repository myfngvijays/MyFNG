/** Lead list cards: Lost, Booking confirmed, and Service Done keep accent. */
export function leadStatusCardColors(leadOrLabel: any): {
  cardBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
} {
  const label =
    typeof leadOrLabel === 'string'
      ? leadOrLabel
      : String(
          leadOrLabel?.display_status ||
            leadOrLabel?.coupon_meta?.last_call_label ||
            leadOrLabel?.status ||
            '',
        );
  const s = String(label || '').toUpperCase();

  if (s.includes('LOST') || s === 'REJECTED') {
    return { cardBg: '#FEF2F2', border: '#FECACA', badgeBg: '#FEE2E2', badgeText: '#B91C1C' };
  }
  if (
    s.includes('BOOKING') ||
    s.includes('SERVICE DONE') ||
    s === 'SERVICE_DONE' ||
    s === 'COMPLETED'
  ) {
    return { cardBg: '#ECFDF5', border: '#A7F3D0', badgeBg: '#D1FAE5', badgeText: '#047857' };
  }
  return { cardBg: '#FFFFFF', border: '#E5E7EB', badgeBg: '#F1F5F9', badgeText: '#475569' };
}

/** Home KPI tiles — full status palette (previous look). */
export function leadStatusKpiColors(leadOrLabel: any): {
  cardBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
} {
  const label =
    typeof leadOrLabel === 'string'
      ? leadOrLabel
      : String(leadOrLabel?.display_status || leadOrLabel?.status || '');
  const s = String(label || '').toUpperCase();
  const incomplete =
    (leadOrLabel && typeof leadOrLabel === 'object' && Boolean(leadOrLabel.is_incomplete)) ||
    s.includes('INCOMPLETE');

  if (s.includes('LOST') || s === 'REJECTED') {
    return { cardBg: '#FEF2F2', border: '#FECACA', badgeBg: '#FEE2E2', badgeText: '#B91C1C' };
  }
  if (s.includes('BOOKING') || s === 'SERVICE DONE' || s.startsWith('SERVICE DONE') || s === 'COMPLETED') {
    return { cardBg: '#ECFDF5', border: '#A7F3D0', badgeBg: '#D1FAE5', badgeText: '#047857' };
  }
  if (s.includes('IN SERVICE') || s === 'IN_PROGRESS') {
    return { cardBg: '#EFF6FF', border: '#BFDBFE', badgeBg: '#DBEAFE', badgeText: '#1D4ED8' };
  }
  if (s.includes('WILL VISIT')) {
    return { cardBg: '#F5F3FF', border: '#DDD6FE', badgeBg: '#EDE9FE', badgeText: '#6D28D9' };
  }
  if (s.includes('CALLBACK') || s.includes('FOLLOW-UP') || s.includes('FOLLOW UP')) {
    return { cardBg: '#F0F9FF', border: '#BAE6FD', badgeBg: '#E0F2FE', badgeText: '#0369A1' };
  }
  if (s.includes('INTERESTED')) {
    return { cardBg: '#FFF7ED', border: '#FED7AA', badgeBg: '#FFEDD5', badgeText: '#C2410C' };
  }
  if (incomplete) {
    return { cardBg: '#FFFBEB', border: '#FDE68A', badgeBg: '#B45309', badgeText: '#FFFFFF' };
  }
  if (s === 'NEW' || s === 'FRESH' || s.includes('FRESH')) {
    return { cardBg: '#EFF6FF', border: '#BFDBFE', badgeBg: '#1D4ED8', badgeText: '#FFFFFF' };
  }
  return { cardBg: '#FFFFFF', border: '#E5E7EB', badgeBg: '#F1F5F9', badgeText: '#475569' };
}

export function statusAccentColor(tint: {
  badgeBg: string;
  badgeText: string;
}): string {
  return tint.badgeText === '#FFFFFF' ? tint.badgeBg : tint.badgeText;
}
