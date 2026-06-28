import { createClient } from '@/lib/supabase/server';
import { googleSheetToCsvExportUrl } from '@/lib/google-sheet-url';
import {
  extractPhonesFromTabularText,
  normalizeIndianPhone,
  parsePhoneList,
} from '@/lib/phone-list-parser';
import { WALLET_BULK_MAX_AMOUNT } from '@/lib/wallet/walletBulkConstants';

export type WalletBulkEntry = { phone: string; amount: number };

export type CustomerWalletMatch = {
  phone: string;
  customer_id: string;
  full_name: string | null;
  current_balance: number;
  amount: number;
};

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

function parseAmount(raw: unknown): number | null {
  const n = Number(String(raw ?? '').replace(/[,₹\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > WALLET_BULK_MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

export function extractWalletEntriesFromTabularText(raw: string): WalletBulkEntry[] {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(splitCsvLine);
  const header = rows[0].map((cell) => cell.toLowerCase());
  const phoneColIdx = header.findIndex((cell) =>
    /^(phone|mobile|contact|customer_phone|whatsapp|number)$/.test(cell) ||
    /\b(phone|mobile|contact)\b/.test(cell),
  );
  const amountColIdx = header.findIndex((cell) =>
    /^(amount|credit|wallet|wallet_amount|balance|value|rs|inr)$/.test(cell) ||
    /\b(amount|credit|wallet)\b/.test(cell),
  );

  const dataRows =
    phoneColIdx >= 0 && rows.length > 1 && /phone|mobile|contact|whatsapp|number/.test(header[phoneColIdx] || '')
      ? rows.slice(1)
      : rows;

  const entries: WalletBulkEntry[] = [];
  for (const row of dataRows) {
    let phone: string | null = null;
    let amount: number | null = null;

    if (phoneColIdx >= 0) {
      phone = normalizeIndianPhone(row[phoneColIdx]);
    }
    if (amountColIdx >= 0) {
      amount = parseAmount(row[amountColIdx]);
    }

    if (!phone) {
      phone = normalizeIndianPhone(row[0]);
    }
    if (amount == null) {
      amount = parseAmount(row[1]) ?? parseAmount(row[2]);
    }

    if (phone && amount != null) {
      entries.push({ phone, amount });
    }
  }

  return dedupeEntries(entries);
}

export function parseWalletEntriesFromDualColumns(phonesRaw: string, amountsRaw: string): WalletBulkEntry[] {
  const phoneLines = String(phonesRaw || '').split(/\r?\n/);
  const amountLines = String(amountsRaw || '').split(/\r?\n/);
  const entries: WalletBulkEntry[] = [];

  const rowCount = Math.max(phoneLines.length, amountLines.length);
  for (let i = 0; i < rowCount; i += 1) {
    const phone = normalizeIndianPhone(phoneLines[i]);
    const amount = parseAmount(amountLines[i]);
    if (phone && amount != null) {
      entries.push({ phone, amount });
    }
  }

  return dedupeEntries(entries);
}

export function parseWalletEntriesFromPlainText(raw: string): WalletBulkEntry[] {
  const entries: WalletBulkEntry[] = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,;\t|]+/).map((p) => p.trim());
    const phone = normalizeIndianPhone(parts[0]);
    const amount = parseAmount(parts[1]);
    if (phone && amount != null) entries.push({ phone, amount });
  }
  return dedupeEntries(entries);
}

function dedupeEntries(entries: WalletBulkEntry[]): WalletBulkEntry[] {
  const byPhone = new Map<string, WalletBulkEntry>();
  for (const entry of entries) {
    byPhone.set(entry.phone, entry);
  }
  return [...byPhone.values()];
}

export async function assertWalletAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', userId: '' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden', userId: '' };
  }

  const roleCode = (userData as { roles?: { role_code?: string } }).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin', userId: '' };
  }

  return { ok: true as const, status: 200, error: null, userId: user.id };
}

export async function resolvePhonesFromBody(body: Record<string, unknown>): Promise<string[]> {
  const googleSheetUrl = String(body?.google_sheet_url || body?.sheet_url || '').trim();
  if (googleSheetUrl) {
    const exportUrl = googleSheetToCsvExportUrl(googleSheetUrl);
    if (!exportUrl) throw new Error('Invalid Google Sheet URL.');
    const res = await fetch(exportUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'MyFNG-Wallet-Bulk/1.0' },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(
        'Could not fetch Google Sheet. Share it as "Anyone with the link → Viewer" or publish to web.',
      );
    }
    const text = await res.text();
    const phones = extractPhonesFromTabularText(text);
    if (!phones.length) throw new Error('No valid mobile numbers found in the Google Sheet.');
    return phones;
  }

  const bulkPhones = parsePhoneList(body?.phones ?? body?.phones_text ?? '');
  const singlePhone = String(body?.phone || '').replace(/\D/g, '').slice(-10);
  return bulkPhones.length > 0 ? bulkPhones : singlePhone.length === 10 ? [singlePhone] : [];
}

export async function resolveWalletBulkEntries(body: Record<string, unknown>): Promise<WalletBulkEntry[]> {
  const rawEntries = body?.entries;
  if (Array.isArray(rawEntries) && rawEntries.length > 0) {
    const parsed = rawEntries
      .map((row: any) => {
        const phone = normalizeIndianPhone(row?.phone ?? row?.mobile);
        const amount = parseAmount(row?.amount);
        return phone && amount != null ? { phone, amount } : null;
      })
      .filter(Boolean) as WalletBulkEntry[];
    if (parsed.length) return dedupeEntries(parsed);
  }

  const phonesColumn = String(body?.phones_column || '').trim();
  const amountsColumn = String(body?.amounts_column || '').trim();
  if (phonesColumn && amountsColumn) {
    const paired = parseWalletEntriesFromDualColumns(phonesColumn, amountsColumn);
    if (paired.length) return paired;
    throw new Error('Phone and Amount columns must have matching rows (one phone and one amount per line).');
  }

  const entriesText = String(body?.entries_text || '').trim();
  if (entriesText) {
    const fromText =
      entriesText.includes(',') || entriesText.includes('\t')
        ? parseWalletEntriesFromPlainText(entriesText)
        : extractWalletEntriesFromTabularText(entriesText);
    if (fromText.length) return fromText;
  }

  const googleSheetUrl = String(body?.google_sheet_url || body?.sheet_url || '').trim();
  if (googleSheetUrl) {
    const exportUrl = googleSheetToCsvExportUrl(googleSheetUrl);
    if (!exportUrl) throw new Error('Invalid Google Sheet URL.');
    const res = await fetch(exportUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'MyFNG-Wallet-Bulk/1.0' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Could not fetch Google Sheet.');
    const text = await res.text();
    const entries = extractWalletEntriesFromTabularText(text);
    if (entries.length) return entries;
    const phones = extractPhonesFromTabularText(text);
    const uniformAmount = parseAmount(body?.amount);
    if (phones.length && uniformAmount != null) {
      return phones.map((phone) => ({ phone, amount: uniformAmount }));
    }
    throw new Error('Google Sheet must have phone + amount columns, or phone column with a uniform amount.');
  }

  const uniformAmount = parseAmount(body?.amount);
  if (uniformAmount == null) {
    throw new Error('Enter a valid amount greater than 0');
  }

  const phones = await resolvePhonesFromBody(body);
  if (!phones.length) {
    throw new Error('Provide phone, phones list, entries, or google_sheet_url');
  }

  return phones.map((phone) => ({ phone, amount: uniformAmount }));
}

export function computeExpiresAt(expiresInDays: number | null | undefined): string | null {
  if (!expiresInDays || !Number.isFinite(expiresInDays) || expiresInDays <= 0) return null;
  const days = Math.min(Math.floor(expiresInDays), 365);
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
}

export async function resolveCustomerWalletMatches(
  supabaseAdmin: any,
  entries: WalletBulkEntry[],
): Promise<{ matches: CustomerWalletMatch[]; notFoundPhones: string[]; invalidAmountPhones: string[] }> {
  const matches: CustomerWalletMatch[] = [];
  const notFoundPhones: string[] = [];
  const invalidAmountPhones: string[] = [];

  for (const entry of entries) {
    if (!parseAmount(entry.amount)) {
      invalidAmountPhones.push(entry.phone);
      continue;
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name')
      .or(`phone.eq.${entry.phone},phone.eq.91${entry.phone}`)
      .maybeSingle();

    if (!customer?.id) {
      notFoundPhones.push(entry.phone);
      continue;
    }

    const { data: wallet } = await supabaseAdmin
      .from('wallet_accounts')
      .select('current_balance')
      .eq('customer_id', customer.id)
      .maybeSingle();

    matches.push({
      phone: entry.phone,
      customer_id: String(customer.id),
      full_name: customer.full_name ?? null,
      current_balance: Number(wallet?.current_balance || 0),
      amount: entry.amount,
    });
  }

  return { matches, notFoundPhones, invalidAmountPhones };
}

export function sumEntryAmounts(entries: WalletBulkEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

export function sumMatchAmounts(matches: CustomerWalletMatch[]): number {
  return matches.reduce((sum, m) => sum + m.amount, 0);
}
