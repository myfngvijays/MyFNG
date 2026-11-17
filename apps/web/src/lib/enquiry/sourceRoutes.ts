/**
 * Per-source telecaller split.
 * One person = 100%. Two or more = their percents must add up to 100.
 */

export const SOURCE_ASSIGN_OPTIONS = [
  { id: 'WEBSITE', label: 'Website', hint: 'Website booking and website OTP' },
  { id: 'APP', label: 'App', hint: 'App booking and app OTP' },
  { id: 'WHATSAPP', label: 'WhatsApp', hint: 'WhatsApp inbox when no message trigger matches' },
  { id: 'META', label: 'Meta / Insta Ads', hint: 'Meta click-to-WhatsApp when no message trigger matches' },
  { id: 'MISA', label: 'MISA AI', hint: 'AI chatbot leads' },
  { id: 'SARV', label: 'Incoming Sarv', hint: 'Incoming and missed Sarv calls' },
  { id: 'GOOGLE', label: 'Google Ads', hint: 'Leads marked Google Ads' },
  { id: 'PARTNER', label: 'Partner', hint: 'Leads marked Partner' },
  { id: 'REFERENCE', label: 'Reference', hint: 'Leads marked Reference' },
  { id: 'BANNER', label: 'Banner / Offline', hint: 'Leads marked Banner/Offline' },
  { id: 'OTHER', label: 'Other', hint: 'Other and Lead Source API' },
] as const;

export type SourceAssignId = (typeof SOURCE_ASSIGN_OPTIONS)[number]['id'];

export type SourceAssignee = {
  telecaller_id: string;
  percent: number;
};

export type SourceRoute = {
  source: SourceAssignId;
  assignees: SourceAssignee[];
};

const SOURCE_IDS = new Set<string>(SOURCE_ASSIGN_OPTIONS.map((s) => s.id));

export function normalizeSourceRoutes(raw: unknown): SourceRoute[] {
  if (!Array.isArray(raw)) return [];
  const out: SourceRoute[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const source = String((item as { source?: string }).source || '')
      .trim()
      .toUpperCase();
    if (!SOURCE_IDS.has(source) || seen.has(source)) continue;
    const people = Array.isArray((item as { assignees?: unknown }).assignees)
      ? (item as { assignees: unknown[] }).assignees
      : [];
    const assignees: SourceAssignee[] = [];
    const seenPeople = new Set<string>();
    for (const person of people) {
      if (!person || typeof person !== 'object') continue;
      const id = String((person as { telecaller_id?: string }).telecaller_id || '').trim();
      if (!id || seenPeople.has(id)) continue;
      const percent = Math.max(0, Math.round(Number((person as { percent?: number }).percent) || 0));
      seenPeople.add(id);
      assignees.push({ telecaller_id: id, percent });
    }
    if (assignees.length === 1) assignees[0].percent = 100;
    if (!assignees.length) continue;
    seen.add(source);
    out.push({ source: source as SourceAssignId, assignees });
  }
  return out;
}

export type CatchAllAssignees = {
  enabled: boolean;
  assignees: SourceAssignee[];
};

export function normalizeCatchAll(raw: unknown): CatchAllAssignees {
  if (!raw || typeof raw !== 'object') return { enabled: false, assignees: [] };
  const enabled = Boolean((raw as { enabled?: unknown }).enabled);
  const people = Array.isArray((raw as { assignees?: unknown }).assignees)
    ? (raw as { assignees: unknown[] }).assignees
    : [];
  const assignees: SourceAssignee[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    if (!person || typeof person !== 'object') continue;
    const id = String((person as { telecaller_id?: string }).telecaller_id || '').trim();
    if (!id || seen.has(id)) continue;
    const percent = Math.max(0, Math.round(Number((person as { percent?: number }).percent) || 0));
    seen.add(id);
    assignees.push({ telecaller_id: id, percent });
  }
  if (assignees.length === 1) assignees[0].percent = 100;
  return { enabled, assignees };
}

export function catchAllReady(route: CatchAllAssignees | null | undefined): boolean {
  if (!route?.enabled || route.assignees.length === 0) return false;
  const total = route.assignees.reduce((sum, row) => sum + Number(row.percent || 0), 0);
  return Math.abs(total - 100) < 0.001;
}

export function sourceRouteReady(route: SourceRoute | null | undefined): boolean {
  if (!route || route.assignees.length === 0) return false;
  const total = route.assignees.reduce((sum, row) => sum + Number(row.percent || 0), 0);
  return Math.abs(total - 100) < 0.001;
}

/** Which source bucket a new lead belongs to. Lead source wins over the coarse channel. */
export function resolveSourceAssignId(
  channel?: string | null,
  leadSource?: string | null,
): SourceAssignId | null {
  const source = String(leadSource || '').trim().toLowerCase();
  if (source === 'google ads') return 'GOOGLE';
  if (source === 'partner') return 'PARTNER';
  if (source === 'reference') return 'REFERENCE';
  if (source === 'banner/offline' || source === 'banner') return 'BANNER';
  if (source === 'other') return 'OTHER';
  if (source === 'website' || source === 'web' || source === 'delhi_service') return 'WEBSITE';
  if (source.includes('app')) return 'APP';
  if (/misa|ai chatbot|chatbot/.test(source)) return 'MISA';
  if (/sarv|incoming call/.test(source)) return 'SARV';
  if (/meta|instagram|facebook/.test(source)) return 'META';
  if (/whatsapp/.test(source)) return 'WHATSAPP';

  const ch = String(channel || '').trim().toUpperCase();
  if (ch === 'WEBSITE_OTP' || ch === 'WEBSITE_BOOKING') return 'WEBSITE';
  if (ch === 'APP_OTP' || ch === 'APP_BOOKING') return 'APP';
  if (ch === 'WHATSAPP') return 'WHATSAPP';
  if (ch === 'WHATSAPP_META') return 'META';
  if (ch === 'MISA') return 'MISA';
  if (ch === 'MANUAL') return 'SARV';
  if (ch === 'ENQUIRY_API') return 'OTHER';
  return null;
}
