import { formatDateTimeIST } from '@/lib/utils';

/** TeleCRM-style compact activity lines (calls, WhatsApp, updates). */

/** e.g. 26 Nov, 5:48 PM — not relative 11d */
export function activityTimestampLabel(iso: string | null | undefined): string {
  const raw = formatDateTimeIST(iso || null);
  if (!raw || raw === '—') return '—';
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return raw;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m[2]) - 1] || m[2];
  const hour = String(Number(m[4]));
  return `${m[1]} ${month}, ${hour}:${m[5]} ${m[6].toUpperCase()}`;
}

export function activityAgeLabel(iso: string | null | undefined): string {
  const t = iso ? Date.parse(String(iso)) : NaN;
  if (!Number.isFinite(t)) return '—';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return 'now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export function compactCallDuration(seconds: unknown): string {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return '0s';
  const total = Math.round(n);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function clipFeedText(text: string, max = 56): string {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function stripDispositionPrefix(notes: string): string {
  return String(notes || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\[Smartflo\]\s*/gi, '')
    .replace(/\bSmartflo\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function dispositionFromNotes(notes: string): string | null {
  const m = String(notes || '').match(/^\[([^\]]+)\]/);
  return m?.[1]?.trim() || null;
}

export function compactCallSummary(input: {
  duration?: unknown;
  callStatus?: string | null;
  outcome?: string | null;
  notes?: string | null;
  title?: string | null;
}): { duration: string; statusText: string; noteText: string } {
  const statusUp = String(input.callStatus || '').toUpperCase();
  const title = String(input.title || '');
  const durNum = Number(input.duration);
  const connected =
    statusUp === 'ANSWERED' ||
    statusUp === 'CONNECTED' ||
    (Number.isFinite(durNum) && durNum > 0 && !['NO_ANSWER', 'BUSY', 'FAILED', 'CANCELLED'].includes(statusUp));
  const fromNotes = dispositionFromNotes(String(input.notes || ''));
  const outcome = String(input.outcome || '').trim();
  let statusText = connected
    ? 'CONNECTED'
    : (fromNotes || outcome || statusUp || 'CALL').replace(/_/g, ' ').toUpperCase();
  if (/phone dial|dial/i.test(title) && (!Number.isFinite(durNum) || durNum <= 0)) {
    statusText = statusText === 'CALL' ? 'DIAL' : statusText;
  }
  const noteBody = stripDispositionPrefix(String(input.notes || ''));
  const noteText = noteBody ? clipFeedText(noteBody, 42) : '(Note not added)';
  return {
    duration: compactCallDuration(input.duration),
    statusText,
    noteText,
  };
}

export function whatsappDirectionInbound(title: string, meta?: Record<string, unknown>): boolean {
  const dir = String(meta?.direction || '').toUpperCase();
  if (dir === 'INBOUND') return true;
  if (dir === 'OUTBOUND') return false;
  return /received|inbound/i.test(String(title || ''));
}

export function compactWhatsappPreview(body: string | null | undefined, title: string): string {
  const raw = String(body || '').trim();
  if (!raw) return 'Message';
  return clipFeedText(raw, 48);
}

export function compactGenericLine(title: string, body?: string | null): string {
  const t = String(title || '').trim();
  const b = String(body || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (b && !b.startsWith('[')) return clipFeedText(b.length > t.length ? b : `${t} · ${b}`, 58);
  return clipFeedText(t, 58);
}