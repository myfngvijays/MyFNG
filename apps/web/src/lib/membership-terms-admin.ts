import { normalizeMembershipType, type MembershipType } from '@/lib/membership-placements';
import { colValue, csvHeaderIndex, parseCsvRows, parseOptionalBool } from '@/lib/content-csv';

export type MembershipTermBulkInput = {
  body: string;
  display_order: number;
  visible_android: boolean;
  visible_ios: boolean;
  visible_web: boolean;
};

export type MembershipTermBulkUpdate = {
  id: string;
  body?: string;
  display_order?: number;
  visible_android?: boolean;
  visible_ios?: boolean;
  visible_web?: boolean;
};

export function normalizeMembershipTermBulkInput(
  raw: Partial<MembershipTermBulkInput>,
  defaultOrder: number,
): MembershipTermBulkInput | null {
  const body = String(raw.body || '').trim();
  if (!body) return null;
  return {
    body,
    display_order: Number.isFinite(Number(raw.display_order)) ? Number(raw.display_order) : defaultOrder,
    visible_android: parseOptionalBool(raw.visible_android, true),
    visible_ios: parseOptionalBool(raw.visible_ios, true),
    visible_web: parseOptionalBool(raw.visible_web, true),
  };
}

export function parseMembershipTermsCsv(text: string): { rows: MembershipTermBulkInput[]; errors: string[] } {
  const table = parseCsvRows(text);
  if (table.length === 0) return { rows: [], errors: ['No rows found in CSV.'] };

  const errors: string[] = [];
  const rows: MembershipTermBulkInput[] = [];
  const headers = table[0].map((v) => v.toLowerCase());
  const hasHeader = csvHeaderIndex(headers, ['body', 'term']) >= 0;
  const startIndex = hasHeader ? 1 : 0;

  const bodyIdx = hasHeader ? csvHeaderIndex(headers, ['body', 'term']) : 0;
  const orderIdx = hasHeader ? csvHeaderIndex(headers, ['display_order', 'order']) : 1;
  const androidIdx = hasHeader ? csvHeaderIndex(headers, ['visible_android', 'android']) : 2;
  const iosIdx = hasHeader ? csvHeaderIndex(headers, ['visible_ios', 'ios']) : 3;
  const webIdx = hasHeader ? csvHeaderIndex(headers, ['visible_web', 'web', 'website']) : 4;

  for (let i = startIndex; i < table.length; i += 1) {
    const cols = table[i];
    const rowNumber = i + 1;
    const normalized = normalizeMembershipTermBulkInput(
      {
        body: colValue(cols, bodyIdx) ?? cols[0],
        display_order: colValue(cols, orderIdx) ?? rows.length + 1,
        visible_android: colValue(cols, androidIdx),
        visible_ios: colValue(cols, iosIdx),
        visible_web: colValue(cols, webIdx),
      },
      rows.length + 1,
    );
    if (!normalized) {
      errors.push(`Row ${rowNumber}: body is required.`);
      continue;
    }
    rows.push(normalized);
  }

  return { rows, errors };
}

export function parseMembershipTermsEditCsv(text: string): { rows: MembershipTermBulkUpdate[]; errors: string[] } {
  const table = parseCsvRows(text);
  if (table.length === 0) return { rows: [], errors: ['No rows found in CSV.'] };

  const errors: string[] = [];
  const rows: MembershipTermBulkUpdate[] = [];
  const headers = table[0].map((v) => v.toLowerCase());
  const hasHeader = csvHeaderIndex(headers, ['id']) >= 0;
  if (!hasHeader) return { rows: [], errors: ['CSV must include an id column for bulk edit.'] };

  const idIdx = csvHeaderIndex(headers, ['id']);
  const bodyIdx = csvHeaderIndex(headers, ['body', 'term']);
  const orderIdx = csvHeaderIndex(headers, ['display_order', 'order']);
  const androidIdx = csvHeaderIndex(headers, ['visible_android', 'android']);
  const iosIdx = csvHeaderIndex(headers, ['visible_ios', 'ios']);
  const webIdx = csvHeaderIndex(headers, ['visible_web', 'web', 'website']);

  for (let i = 1; i < table.length; i += 1) {
    const cols = table[i];
    const rowNumber = i + 1;
    const id = String(colValue(cols, idIdx) || '').trim();
    if (!id) {
      errors.push(`Row ${rowNumber}: id is required.`);
      continue;
    }
    const body = bodyIdx >= 0 ? colValue(cols, bodyIdx) : undefined;
    if (body !== undefined && !String(body).trim()) {
      errors.push(`Row ${rowNumber}: body cannot be empty.`);
      continue;
    }
    const update: MembershipTermBulkUpdate = { id };
    if (body !== undefined) update.body = String(body).trim();
    if (orderIdx >= 0 && colValue(cols, orderIdx) != null) {
      update.display_order = Number(colValue(cols, orderIdx));
    }
    if (androidIdx >= 0 && colValue(cols, androidIdx) != null) {
      update.visible_android = parseOptionalBool(colValue(cols, androidIdx), true);
    }
    if (iosIdx >= 0 && colValue(cols, iosIdx) != null) {
      update.visible_ios = parseOptionalBool(colValue(cols, iosIdx), true);
    }
    if (webIdx >= 0 && colValue(cols, webIdx) != null) {
      update.visible_web = parseOptionalBool(colValue(cols, webIdx), true);
    }
    rows.push(update);
  }

  return { rows, errors };
}

export const MEMBERSHIP_TERMS_CSV_TEMPLATE = `body,display_order,visible_android,visible_ios,visible_web
Coverage is valid for 12 months from the date of purchase.,1,true,true,true
RSA assistance is available 24/7 across major cities.,2,true,true,true`;

export const MEMBERSHIP_TERMS_EDIT_CSV_TEMPLATE = `id,body,display_order,visible_android,visible_ios,visible_web
paste-row-id-here,Updated term text,1,true,true,true`;

export function membershipTermBulkToInsert(row: MembershipTermBulkInput, membershipType: MembershipType) {
  const visibleApp = row.visible_android || row.visible_ios;
  return {
    membership_type: normalizeMembershipType(membershipType),
    body: row.body,
    display_order: row.display_order,
    visible_android: row.visible_android,
    visible_ios: row.visible_ios,
    visible_web: row.visible_web,
    visible_app: visibleApp,
    active: visibleApp || row.visible_web,
    updated_at: new Date().toISOString(),
  };
}
