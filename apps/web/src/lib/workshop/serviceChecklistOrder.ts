export type SortableChecklistItem = {
  id?: string | number;
  name?: string;
  item_name?: string;
};

function checklistDisplayName(item: SortableChecklistItem): string {
  return String(item.name || item.item_name || '').trim();
}

function checklistNumericId(item: SortableChecklistItem): number {
  const n = Number(item.id);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Test Drive then Final Inspection always last (standard workshop order). */
function closingChecklistRank(name: string): number | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (n.includes('final inspection')) return 2;
  if (
    n === 'test drive' ||
    n === 'trial drive' ||
    n.includes('test drive') ||
    n.includes('trial drive')
  ) {
    return 1;
  }
  return null;
}

export function sortServiceChecklistItems<T extends SortableChecklistItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aClose = closingChecklistRank(checklistDisplayName(a));
    const bClose = closingChecklistRank(checklistDisplayName(b));

    if (aClose === null && bClose === null) {
      return checklistNumericId(a) - checklistNumericId(b);
    }
    if (aClose === null) return -1;
    if (bClose === null) return 1;
    if (aClose !== bClose) return aClose - bClose;
    return checklistNumericId(a) - checklistNumericId(b);
  });
}
