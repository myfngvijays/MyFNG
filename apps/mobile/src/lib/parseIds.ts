/**
 * Safely parse ID lists from service_leads JSONB / string / array columns.
 * Mirrors web telecaller parseIds — never throws.
 */
export function parseIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw !== 'string') return [];
  const s = raw.trim();
  if (!s) return [];

  if (s.startsWith('[') || s.startsWith('{') || s.startsWith('"')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((v) => v.trim()).filter(Boolean);
      }
      if (parsed && typeof parsed === 'object') {
        return Object.values(parsed).map(String).map((v) => v.trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }

  // Postgres array literal: {uuid1,uuid2}
  if (s.startsWith('{') && s.endsWith('}')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((v) => v.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }

  return s.split(',').map((v) => v.trim()).filter(Boolean);
}

export function parseCodes(raw: unknown): string[] {
  return parseIds(raw)
    .map((c) => String(c || '').trim().toUpperCase())
    .filter(Boolean);
}
