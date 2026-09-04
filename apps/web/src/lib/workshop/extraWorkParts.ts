export type ExtraWorkPartLine = {
  name: string;
  qty: number;
  unit_price: number;
  amount: number;
  kind?: 'PART' | 'LABOUR' | 'OTHER';
};

export function normalizeExtraWorkPartLines(raw: unknown): ExtraWorkPartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtraWorkPartLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const name = String((row as any).name || (row as any).description || '').trim();
    if (!name) continue;
    const qty = Math.max(0.01, Number((row as any).qty ?? (row as any).quantity ?? 1) || 1);
    const unit_price = Math.max(0, Number((row as any).unit_price ?? (row as any).rate ?? 0) || 0);
    const amountRaw = Number((row as any).amount);
    const amount = Number.isFinite(amountRaw) && amountRaw >= 0 ? amountRaw : qty * unit_price;
    const kindRaw = String((row as any).kind || '').toUpperCase();
    const kind =
      kindRaw === 'LABOUR' || kindRaw === 'LABOR'
        ? 'LABOUR'
        : kindRaw === 'PART' || kindRaw === 'PARTS'
          ? 'PART'
          : 'OTHER';
    out.push({ name, qty, unit_price, amount, kind });
  }
  return out;
}

export function sumExtraWorkPartLines(lines: ExtraWorkPartLine[]) {
  return lines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export function splitExtraWorkPartTotals(lines: ExtraWorkPartLine[]) {
  let labour = 0;
  let parts = 0;
  for (const row of lines) {
    const amt = Number(row.amount) || 0;
    if (row.kind === 'LABOUR') labour += amt;
    else parts += amt;
  }
  // If nothing marked LABOUR, keep full total as parts (OEM) for legacy fields.
  if (labour <= 0 && parts <= 0) {
    const total = sumExtraWorkPartLines(lines);
    return { parts: total, labour: 0, total };
  }
  return { parts, labour, total: parts + labour };
}

export function extraWorkPartsToIncludedItems(lines: ExtraWorkPartLine[]) {
  return lines.map((row) => ({
    name: row.name,
    quantity: row.qty,
    unit_price: row.unit_price,
    amount: row.amount,
    kind: row.kind || 'OTHER',
  }));
}

function unknownColumnFromError(message: string): string | null {
  const msg = String(message || '');
  const m =
    msg.match(/Could not find the '([^']+)' column/i) ||
    msg.match(/column ["']([^"']+)["'] of relation/i) ||
    msg.match(/column (\w+) does not exist/i);
  return m?.[1] || null;
}

/** Retry update/insert while dropping columns missing from this DB schema. */
export async function supabaseWriteDropUnknownColumns(
  client: any,
  table: string,
  mode: 'update' | 'insert',
  payload: Record<string, unknown>,
  opts?: { eq?: { column: string; value: string }; select?: string },
) {
  let current: Record<string, unknown> = { ...payload };
  for (let i = 0; i < 10; i++) {
    let q =
      mode === 'insert'
        ? client.from(table).insert(current)
        : client.from(table).update(current).eq(opts?.eq?.column || 'id', opts?.eq?.value);
    if (opts?.select) q = q.select(opts.select);
    const res = opts?.select ? await q.maybeSingle() : await q;
    if (!res.error) return res;
    const col = unknownColumnFromError(res.error.message);
    if (col && Object.prototype.hasOwnProperty.call(current, col)) {
      delete current[col];
      continue;
    }
    return res;
  }
  return { data: null, error: { message: 'Write failed after schema fallbacks' } };
}
