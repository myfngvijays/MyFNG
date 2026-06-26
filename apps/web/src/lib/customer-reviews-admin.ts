export type CustomerReviewScreen = 'home' | 'rsa';

export type CustomerReviewInput = {
  name: string;
  car: string;
  stars: number;
  text: string;
  date: string;
  display_order: number;
  is_active: boolean;
  screen: CustomerReviewScreen;
};

function normalizeScreen(raw: unknown): CustomerReviewScreen {
  return String(raw || 'home').trim().toLowerCase() === 'rsa' ? 'rsa' : 'home';
}

export function normalizeCustomerReviewInput(raw: Partial<CustomerReviewInput>): CustomerReviewInput | null {
  const name = String(raw.name || '').trim();
  const text = String(raw.text || '').trim();
  const date = String(raw.date || '').trim();
  if (!name || !text || !date) return null;

  const car = String(raw.car || '').trim();
  const stars = Math.min(5, Math.max(1, Number(raw.stars) || 5));
  const display_order = Number.isFinite(Number(raw.display_order)) ? Number(raw.display_order) : 0;
  const is_active =
    raw.is_active === false || String(raw.is_active).toLowerCase() === 'false' ? false : true;
  const screen = normalizeScreen(raw.screen);

  return { name, car, stars, text, date, display_order, is_active, screen };
}

function parseCsvLine(line: string): string[] {
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

export function parseCustomerReviewsCsv(text: string): {
  rows: CustomerReviewInput[];
  errors: string[];
} {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ['No rows found in CSV.'] };
  }

  const errors: string[] = [];
  const rows: CustomerReviewInput[] = [];
  let startIndex = 0;
  const firstCols = parseCsvLine(lines[0]).map((v) => v.toLowerCase());
  const hasHeader = firstCols.includes('name') && (firstCols.includes('text') || firstCols.includes('review'));
  if (hasHeader) startIndex = 1;

  for (let i = startIndex; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const rowNumber = i + 1;
    const normalized = normalizeCustomerReviewInput({
      name: cols[0],
      car: cols[1],
      stars: Number(cols[2]),
      text: cols[3],
      date: cols[4],
      display_order: cols[5] != null && cols[5] !== '' ? Number(cols[5]) : rows.length + 1,
      is_active: cols[6] != null && cols[6] !== '' ? cols[6] : true,
      screen: cols[7] || 'home',
    });
    if (!normalized) {
      errors.push(`Row ${rowNumber}: name, text, and date are required.`);
      continue;
    }
    rows.push(normalized);
  }

  return { rows, errors };
}

export const CUSTOMER_REVIEWS_CSV_TEMPLATE = `name,car,stars,text,date,display_order,is_active,screen
Rahul Sharma,Hyundai Creta,5,Excellent service! My car feels brand new.,Jan 2025,1,true,home
Priya Patel,Maruti Swift,5,Transparent pricing and great updates during service.,Feb 2025,2,true,rsa`;

export function toCustomerReviewDbRow(input: CustomerReviewInput) {
  return {
    name: input.name,
    car: input.car,
    stars: input.stars,
    text: input.text,
    date: input.date,
    display_order: input.display_order,
    is_active: input.is_active,
    screen: input.screen,
  };
}
