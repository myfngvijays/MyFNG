export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

export function parseCsvRows(text: string): string[][] {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
}

export function parseOptionalBool(raw: unknown, fallback = true): boolean {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'boolean') return raw;
  const value = String(raw).trim().toLowerCase();
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return true;
}

export function csvHeaderIndex(headers: string[], names: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

export function colValue(cols: string[], index: number): string | undefined {
  if (index < 0 || index >= cols.length) return undefined;
  const value = cols[index];
  return value === '' ? undefined : value;
}
