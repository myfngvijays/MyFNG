import { colValue, csvHeaderIndex, parseCsvRows, parseOptionalBool } from '@/lib/content-csv';
import { normalizePublicFaqGroup, type PublicFaqGroup } from '@/lib/public-faqs-db';

export type PublicFaqBulkInput = {
  question: string;
  answer: string;
  display_order: number;
  visible_android: boolean;
  visible_ios: boolean;
  visible_web: boolean;
};

export type PublicFaqBulkUpdate = {
  id: string;
  question?: string;
  answer?: string;
  display_order?: number;
  visible_android?: boolean;
  visible_ios?: boolean;
  visible_web?: boolean;
};

export function normalizePublicFaqBulkInput(
  raw: Partial<PublicFaqBulkInput>,
  defaultOrder: number,
): PublicFaqBulkInput | null {
  const question = String(raw.question || '').trim();
  const answer = String(raw.answer || '').trim();
  if (!question || !answer) return null;
  return {
    question,
    answer,
    display_order: Number.isFinite(Number(raw.display_order)) ? Number(raw.display_order) : defaultOrder,
    visible_android: parseOptionalBool(raw.visible_android, true),
    visible_ios: parseOptionalBool(raw.visible_ios, true),
    visible_web: parseOptionalBool(raw.visible_web, true),
  };
}

export function parsePublicFaqsCsv(text: string): { rows: PublicFaqBulkInput[]; errors: string[] } {
  const table = parseCsvRows(text);
  if (table.length === 0) return { rows: [], errors: ['No rows found in CSV.'] };

  const errors: string[] = [];
  const rows: PublicFaqBulkInput[] = [];
  const headers = table[0].map((v) => v.toLowerCase());
  const hasHeader = csvHeaderIndex(headers, ['question', 'q']) >= 0;
  const startIndex = hasHeader ? 1 : 0;

  const questionIdx = hasHeader ? csvHeaderIndex(headers, ['question', 'q']) : 0;
  const answerIdx = hasHeader ? csvHeaderIndex(headers, ['answer', 'a']) : 1;
  const orderIdx = hasHeader ? csvHeaderIndex(headers, ['display_order', 'order']) : 2;
  const androidIdx = hasHeader ? csvHeaderIndex(headers, ['visible_android', 'android']) : 3;
  const iosIdx = hasHeader ? csvHeaderIndex(headers, ['visible_ios', 'ios']) : 4;
  const webIdx = hasHeader ? csvHeaderIndex(headers, ['visible_web', 'web', 'website']) : 5;

  for (let i = startIndex; i < table.length; i += 1) {
    const cols = table[i];
    const rowNumber = i + 1;
    const normalized = normalizePublicFaqBulkInput(
      {
        question: colValue(cols, questionIdx) ?? cols[0],
        answer: colValue(cols, answerIdx) ?? cols[1],
        display_order: colValue(cols, orderIdx) ?? rows.length + 1,
        visible_android: colValue(cols, androidIdx),
        visible_ios: colValue(cols, iosIdx),
        visible_web: colValue(cols, webIdx),
      },
      rows.length + 1,
    );
    if (!normalized) {
      errors.push(`Row ${rowNumber}: question and answer are required.`);
      continue;
    }
    rows.push(normalized);
  }

  return { rows, errors };
}

export function parsePublicFaqsEditCsv(text: string): { rows: PublicFaqBulkUpdate[]; errors: string[] } {
  const table = parseCsvRows(text);
  if (table.length === 0) return { rows: [], errors: ['No rows found in CSV.'] };

  const errors: string[] = [];
  const rows: PublicFaqBulkUpdate[] = [];
  const headers = table[0].map((v) => v.toLowerCase());
  const hasHeader = csvHeaderIndex(headers, ['id']) >= 0;
  if (!hasHeader) return { rows: [], errors: ['CSV must include an id column for bulk edit.'] };

  const idIdx = csvHeaderIndex(headers, ['id']);
  const questionIdx = csvHeaderIndex(headers, ['question', 'q']);
  const answerIdx = csvHeaderIndex(headers, ['answer', 'a']);
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
    const question = questionIdx >= 0 ? colValue(cols, questionIdx) : undefined;
    const answer = answerIdx >= 0 ? colValue(cols, answerIdx) : undefined;
    if (question !== undefined && !String(question).trim()) {
      errors.push(`Row ${rowNumber}: question cannot be empty.`);
      continue;
    }
    if (answer !== undefined && !String(answer).trim()) {
      errors.push(`Row ${rowNumber}: answer cannot be empty.`);
      continue;
    }
    const update: PublicFaqBulkUpdate = { id };
    if (question !== undefined) update.question = String(question).trim();
    if (answer !== undefined) update.answer = String(answer).trim();
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

export const PUBLIC_FAQS_CSV_TEMPLATE = `question,answer,display_order,visible_android,visible_ios,visible_web
What is MyFNG?,MyFNG is a trusted car service platform offering doorstep and workshop services.,1,true,true,true
How do I book a service?,Open the app or website and choose your service package to book instantly.,2,true,true,true`;

export const PUBLIC_FAQS_EDIT_CSV_TEMPLATE = `id,question,answer,display_order,visible_android,visible_ios,visible_web
paste-row-id-here,Updated question?,Updated answer.,1,true,true,true`;

export function publicFaqBulkToInsert(
  row: PublicFaqBulkInput,
  faqGroup: PublicFaqGroup,
  sectionKey: string,
  sectionTitle: string,
) {
  const visibleApp = row.visible_android || row.visible_ios;
  return {
    faq_group: normalizePublicFaqGroup(faqGroup),
    section_key: sectionKey,
    section_title: sectionTitle,
    question: row.question,
    answer: row.answer,
    display_order: row.display_order,
    visible_android: row.visible_android,
    visible_ios: row.visible_ios,
    visible_web: row.visible_web,
    visible_app: visibleApp,
    active: visibleApp || row.visible_web,
    updated_at: new Date().toISOString(),
  };
}
