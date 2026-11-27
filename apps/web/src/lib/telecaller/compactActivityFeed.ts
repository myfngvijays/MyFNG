import { formatDateTimeIST } from '@/lib/utils';
import { initialsFromName } from '@/lib/telecaller/crmReportsRange';

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
  const t = activityHeadline(title, body);
  const b = String(body || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (b && !b.startsWith('[') && t !== b) {
    const combined = b.length > t.length ? b : `${t} · ${b}`;
    return clipFeedText(combined, 72);
  }
  return clipFeedText(t, 72);
}

const AUTO_HAY_RE =
  /\b(waca|misa|whatsapp_admin|template|auto\s*msg|automated|bot\b|api\s*request|smartflo|pricing\s*sent)/i;

export function activityIsAutomated(
  title: string,
  body?: string | null,
  meta?: Record<string, unknown>,
): boolean {
  const template = String(meta?.message_type || meta?.template_name || '').toLowerCase();
  if (template && template !== 'text') return true;
  const hay = [title, body, String(meta?.event || ''), String(meta?.title || '')].join(' ');
  return AUTO_HAY_RE.test(hay);
}

function pickName(raw: string): string {
  return String(raw || '')
    .replace(/\s+by\s+.+$/i, '')
    .replace(/[·,].*$/, '')
    .trim();
}

/** Right-side badge(s): actor for the row, or from→to on transfer. */
export function activityEndInitials(
  title: string,
  body?: string | null,
  meta?: Record<string, unknown>,
): string[] {
  if (meta?.transfer) {
    const from = String(meta?.from_name || meta?.by || '').trim();
    const to = String(meta?.to_name || '').trim();
    const badges = [initialsFromName(from), initialsFromName(to)].filter((x) => x && x !== '?');
    if (badges.length) return badges.slice(0, 2);
  }
  const by = String(meta?.by || meta?.actor_name || meta?.telecaller_name || '').trim();
  if (by) return [initialsFromName(by)];

  return activityAssigneeInitials(title, body, meta);
}

/** Initials for assignee(s): current actor, reassign from→to, or "added by". */
export function activityAssigneeInitials(
  title: string,
  body?: string | null,
  meta?: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  const by = String(meta?.by || meta?.actor_name || meta?.telecaller_name || '').trim();
  if (by) out.push(initialsFromName(by));

  const text = `${title}\n${body || ''}`;
  const transferred = text.match(/lead\s+transferred\s*·\s*([^→\n]+?)\s*→\s*([^\n]+)/i);
  if (transferred) {
    out.push(initialsFromName(pickName(transferred[1])));
    out.push(initialsFromName(pickName(transferred[2])));
    return Array.from(new Set(out.filter((x) => x && x !== '?')));
  }
  const reassignAlt = text.match(/reassign(?:ed)?\s+from\s+([^->\n]+?)\s*(?:->|→)\s*([^\n·,]+)/i);
  if (reassignAlt) {
    out.push(initialsFromName(pickName(reassignAlt[1])));
    out.push(initialsFromName(pickName(reassignAlt[2])));
  }

  const assigned = text.match(/lead\s+assigned\s+to\s+([^\n·,]+)/i);
  if (assigned) out.push(initialsFromName(pickName(assigned[1])));

  const added = text.match(/lead\s+added\s+by\s+([^\n·,]+)/i);
  if (added) out.push(initialsFromName(pickName(added[1])));

  const createdBy = text.match(/(?:created|added)\s+by\s+([^\n·,]+)/i);
  if (createdBy) out.push(initialsFromName(pickName(createdBy[1])));

  return Array.from(new Set(out.filter((x) => x && x !== '?')));
}

export function activityHeadline(title: string, body?: string | null): string {
  const t = String(title || '').trim();
  const lines = String(body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const tagLine = lines.find((l) => /^leadtag\s*:/i.test(l));
  if (tagLine) {
    const m = tagLine.match(/^leadtag\s*:\s*(.+?)\s*(?:->|→)\s*(.+)$/i);
    if (m) return `Lead tag · ${m[2].trim()}`;
    return clipFeedText(tagLine.replace(/^leadtag\s*:\s*/i, 'Lead tag · '), 58);
  }

  if (/^details updated$/i.test(t) && lines[0]) return clipFeedText(lines[0], 58);

  if (/lead\s+transferred/i.test(t)) return t;

  if (/reassign/i.test(t) || /reassign/i.test(body || '')) {
    const m = `${t}\n${body || ''}`.match(
      /reassign(?:ed)?\s+from\s+([^->\n]+?)\s*(?:->|→)\s*([^\n]+)/i,
    );
    if (m) return `Lead reassigned · ${pickName(m[1])} → ${pickName(m[2])}`;
  }

  if (/^lead created$/i.test(t)) return 'Lead created';

  if (/^status\s*:/i.test(t)) return clipFeedText(t.replace(/^status\s*:\s*/i, 'Status · '), 58);

  return t;
}