export type CustomRepairLineItem = {
  name: string;
  qty: number;
  amount: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseCustomRepairItems(lead: {
  meta?: unknown;
  description?: string | null;
  service_type?: string | null;
}): CustomRepairLineItem[] {
  const meta = asRecord(lead.meta);
  const raw = meta?.custom_repair_items;
  if (Array.isArray(raw)) {
    return raw
      .map((row) => {
        const item = asRecord(row) || {};
        const name = String(item.name || item.title || item.description || '').trim();
        const qty = Math.max(1, Number(item.qty || item.quantity || 1) || 1);
        const amount = Number(item.amount || item.price || 0);
        return { name, qty, amount: Number.isFinite(amount) ? amount : 0 };
      })
      .filter((row) => row.name.length > 0);
  }

  if (!meta?.custom_repair && !/custom repair/i.test(String(lead.service_type || ''))) {
    return [];
  }

  const lines = String(lead.description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^custom repair$/i.test(line));
  return lines
    .map((line) => {
      const qtyMatch = line.match(/\sx(\d+)\s*$/i);
      const qty = qtyMatch ? Math.max(1, Number(qtyMatch[1]) || 1) : 1;
      const name = qtyMatch ? line.replace(/\sx\d+\s*$/i, '').trim() : line;
      return { name, qty, amount: 0 };
    })
    .filter((row) => row.name.length > 0);
}
