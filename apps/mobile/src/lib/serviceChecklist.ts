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

export function parseServiceChecklistItems(raw: unknown) {
  let items: unknown = raw;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];

  const mapped = items.map((item: any, index: number) => {
    const status = String(item?.status || '').toUpperCase();
    return {
      id: String(item?.id ?? index + 1),
      item_name: String(item?.name || item?.item_name || `Task ${index + 1}`),
      is_completed: status === 'COMPLETED' || status === 'DONE' || item?.is_completed === true,
      category: item?.category ? String(item.category) : undefined,
    };
  });

  return sortServiceChecklistItems(mapped);
}
