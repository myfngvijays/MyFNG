export function normalizeIndianPhone(raw: unknown): string | null {
  const phone = String(raw ?? '').replace(/\D/g, '').slice(-10);
  return phone.length === 10 ? phone : null;
}

export function parsePhoneList(input: unknown): string[] {
  const raw: string[] = [];
  if (Array.isArray(input)) {
    for (const item of input) raw.push(String(item ?? ''));
  } else if (typeof input === 'string') {
    raw.push(...input.split(/[\n,;|\t]+/));
  }
  const normalized = raw
    .map((part) => normalizeIndianPhone(part))
    .filter((phone): phone is string => Boolean(phone));
  return [...new Set(normalized)];
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
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
    if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, '').trim());
}

export function extractPhonesFromTabularText(raw: string): string[] {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(splitCsvLine);
  const header = rows[0].map((cell) => cell.toLowerCase());
  const phoneColIdx = header.findIndex((cell) =>
    /^(phone|mobile|contact|customer_phone|customer mobile|whatsapp|number)$/.test(cell) ||
    /\b(phone|mobile|contact)\b/.test(cell),
  );

  const dataRows =
    phoneColIdx >= 0 && rows.length > 1 && /phone|mobile|contact|whatsapp|number/.test(header[phoneColIdx] || '')
      ? rows.slice(1)
      : rows;

  const phones: string[] = [];
  for (const row of dataRows) {
    if (phoneColIdx >= 0) {
      const phone = normalizeIndianPhone(row[phoneColIdx]);
      if (phone) phones.push(phone);
      continue;
    }
    for (const cell of row) {
      const phone = normalizeIndianPhone(cell);
      if (phone) phones.push(phone);
    }
  }

  return [...new Set(phones)];
}

export function extractPhonesFromPlainText(raw: string): string[] {
  const tabular = extractPhonesFromTabularText(raw);
  if (tabular.length) return tabular;
  return parsePhoneList(raw);
}
