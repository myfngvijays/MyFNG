import { resolveAdminCrmStatusId } from '@/lib/telecaller/leadDisplayStatus';
import {
  ACTIVITY_BY_KEY,
  FIELD_BY_KEY,
  resolveConditionRange,
  type FieldDef,
  type LeadCondition,
} from '@/lib/crm/leadConditions';

export type LeadConditionsClientContext = {
  tagIdsByLead?: Map<string, Set<string>>;
  triggerIdByLead?: (lead: unknown) => string | null;
};

const TRUTHY = new Set(['true', 'yes', '1', 'checked']);

function readColumn(lead: Record<string, unknown>, column: string): unknown {
  const col = String(column || '').trim();
  if (!col) return undefined;
  if (!col.includes('->>')) {
    return lead[col];
  }
  const [rootRaw, keyRaw] = col.split('->>');
  const root = rootRaw.trim();
  const key = keyRaw.replace(/'/g, '').trim();
  const meta = lead[root];
  if (meta && typeof meta === 'object') return (meta as Record<string, unknown>)[key];
  return undefined;
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function inDateRange(iso: unknown, c: LeadCondition): boolean {
  const r = resolveConditionRange(c);
  const t = Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return false;
  if (r.from && t < Date.parse(r.from)) return false;
  if (r.to && t > Date.parse(r.to)) return false;
  return true;
}

function matchField(lead: Record<string, unknown>, c: LeadCondition, f: FieldDef, ctx: LeadConditionsClientContext): boolean {
  if (f.key === 'tags') {
    const have = ctx.tagIdsByLead?.get(String(lead.id || '')) || new Set<string>();
    const values = (c.values || []).map((v) => String(v).trim()).filter(Boolean);
    if (c.op === 'empty') return have.size === 0;
    if (c.op === 'not_empty') return have.size > 0;
    if (c.op === 'any_of') return values.some((id) => have.has(id));
    if (c.op === 'none_of') return values.every((id) => !have.has(id));
    return true;
  }

  if (f.key === 'crm_status') {
    const id = resolveAdminCrmStatusId(lead);
    const values = (c.values || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
    const val = String(id || '').toUpperCase();
    if (c.op === 'empty') return !val || val === 'FRESH';
    if (c.op === 'not_empty') return Boolean(val);
    if (c.op === 'any_of') {
      return values.some((v) => v === val || (v === 'FRESH' && (!val || val === 'FRESH')));
    }
    if (c.op === 'none_of') {
      return values.every((v) => v !== val && !(v === 'FRESH' && (!val || val === 'FRESH')));
    }
    return true;
  }

  if (f.key === 'trigger' && ctx.triggerIdByLead) {
    const tid = ctx.triggerIdByLead(lead);
    const values = (c.values || []).map((v) => String(v).trim()).filter(Boolean);
    if (c.op === 'empty') return !tid;
    if (c.op === 'not_empty') return Boolean(tid);
    if (c.op === 'any_of') return tid ? values.includes(tid) : false;
    if (c.op === 'none_of') return !tid || !values.includes(tid);
    return true;
  }

  const raw = readColumn(lead, f.column);
  const value = str(c.value);
  const values = (c.values || []).map((v) => String(v).trim()).filter(Boolean);

  if (c.op === 'empty') return raw == null || str(raw) === '';
  if (c.op === 'not_empty') return raw != null && str(raw) !== '';

  switch (f.type) {
    case 'text': {
      const hay = str(raw).toLowerCase();
      const needle = value.toLowerCase();
      if (c.op === 'contains') return needle ? hay.includes(needle) : true;
      if (c.op === 'not_contains') return needle ? !hay.includes(needle) : true;
      if (c.op === 'is') return hay === needle;
      if (c.op === 'is_not') return hay !== needle;
      return true;
    }
    case 'select': {
      const cell = str(raw);
      const cellLower = cell.toLowerCase();
      if (c.op === 'any_of') {
        if (f.partial) return values.some((v) => cellLower.includes(v.toLowerCase()));
        return values.includes(cell);
      }
      if (c.op === 'none_of') {
        if (f.partial) return values.every((v) => !cellLower.includes(v.toLowerCase()));
        return !values.includes(cell);
      }
      return true;
    }
    case 'number': {
      const a = num(c.value);
      const b = num(c.extra?.to_value);
      const cell = num(raw);
      if (c.op === 'eq') return Number.isFinite(a) && cell === a;
      if (c.op === 'gt') return Number.isFinite(a) && cell > a;
      if (c.op === 'lt') return Number.isFinite(a) && cell < a;
      if (c.op === 'between') {
        if (Number.isFinite(a) && cell < a) return false;
        if (Number.isFinite(b) && cell > b) return false;
        return true;
      }
      return true;
    }
    case 'date': {
      if (c.op === 'in_range') return inDateRange(raw, c);
      return true;
    }
    case 'bool': {
      const yes = TRUTHY.has(str(raw).toLowerCase()) || raw === true;
      if (c.op === 'yes') return yes;
      if (c.op === 'no') return !yes;
      return true;
    }
  }
  return true;
}

function matchActivity(lead: Record<string, unknown>, c: LeadCondition): boolean | null {
  const meta =
    lead.coupon_meta && typeof lead.coupon_meta === 'object'
      ? (lead.coupon_meta as Record<string, unknown>)
      : {};
  const has = c.op !== 'has_not';
  const x = c.extra || {};

  switch (c.key) {
    case 'whatsapp': {
      const at = meta.last_inbound_at;
      const exists = Boolean(str(at));
      if (!has) return !exists || !inDateRange(at, c);
      if (!exists) return false;
      return inDateRange(at, c);
    }
    case 'note': {
      const note = str(meta.telecaller_remarks || lead.notes);
      const text = str(c.value).toLowerCase();
      if (!has) {
        if (text) return !note.toLowerCase().includes(text);
        return !note;
      }
      if (text) return note.toLowerCase().includes(text);
      return Boolean(note);
    }
    case 'call': {
      const calls = num(lead.total_calls);
      const last = lead.last_call_at || meta.last_call_at;
      const exists = (Number.isFinite(calls) && calls > 0) || Boolean(str(last));
      if (!has) return !exists;
      if (!exists) return false;
      if (x.min_duration) {
        const min = Number(x.min_duration);
        if (Number.isFinite(min) && min > 0) {
          const dur = num(meta.last_call_duration);
          if (Number.isFinite(dur) && dur < min) return false;
        }
      }
      return inDateRange(last, c);
    }
    default:
      return null;
  }
}

export function leadMatchesLeadConditions(
  lead: unknown,
  conditions: LeadCondition[],
  ctx: LeadConditionsClientContext = {},
): boolean {
  if (!conditions.length) return true;
  const row = lead && typeof lead === 'object' ? (lead as Record<string, unknown>) : {};
  for (const c of conditions) {
    const field = FIELD_BY_KEY.get(c.key);
    if (field) {
      if (!matchField(row, c, field, ctx)) return false;
      continue;
    }
    if (ACTIVITY_BY_KEY.has(c.key)) {
      const hit = matchActivity(row, c);
      if (hit === false) return false;
      if (hit === true) continue;
      // Complex activity (task, merge, API) — cannot evaluate on loaded rows; do not exclude.
      continue;
    }
  }
  return true;
}