import 'server-only';
import {
  FIELD_BY_KEY,
  resolveConditionRange,
  type FieldDef,
  type LeadCondition,
} from '@/lib/crm/leadConditions';

/**
 * Turns Leads-list conditions into a PostgREST query on service_leads.
 *
 * Activity conditions use embedded joins with an alias per condition:
 *   has     → `_c0:telecaller_call_logs!inner(id)` + filters on `_c0.*`
 *   has not → `_c0:telecaller_call_logs(id)` + filters + `_c0 is null` (anti-join)
 * so no long id lists go into the URL. Custom API runs are few, so those use an id list.
 *
 * Embedded alias keys (`_c…`) come back on each row — strip them with stripConditionKeys().
 */

export type LeadConditionPlan = {
  /** Append to the select() string. */
  select: string;
  apply: (query: any) => any;
  /** Keys to remove from returned rows. */
  aliases: string[];
};

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
const TRUTHY = ['true', 'yes', 'Yes', 'YES', '1', 'checked'];

/** Quote a value for a PostgREST or()/in() list. */
function q(v: string) {
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** % and _ are wildcards in ilike; commas/parens break or() lists — keep the text plain. */
function likeText(v: string) {
  return String(v || '')
    .replace(/[%_]/g, ' ')
    .replace(/[,()]/g, ' ')
    .trim();
}

function isBoolColumn(f: FieldDef) {
  return !f.column.includes('->>');
}

function applyField(query: any, c: LeadCondition, f: FieldDef, alias: string, selects: string[], aliases: string[]) {
  const col = f.column;
  const values = (c.values || []).map((v) => String(v).trim()).filter(Boolean);
  const value = String(c.value || '').trim();

  if (f.key === 'tags') {
    if (c.op === 'any_of' && values.length) {
      selects.push(`${alias}:crm_lead_tag_map!inner(tag_id)`);
      aliases.push(alias);
      return query.in(`${alias}.tag_id`, values);
    }
    if (c.op === 'none_of' && values.length) {
      selects.push(`${alias}:crm_lead_tag_map(tag_id)`);
      aliases.push(alias);
      return query.in(`${alias}.tag_id`, values).is(alias, null);
    }
    if (c.op === 'empty') {
      selects.push(`${alias}:crm_lead_tag_map(tag_id)`);
      aliases.push(alias);
      return query.is(alias, null);
    }
    if (c.op === 'not_empty') {
      selects.push(`${alias}:crm_lead_tag_map!inner(tag_id)`);
      aliases.push(alias);
      return query;
    }
    return query;
  }

  if (c.op === 'empty') {
    return f.type === 'text' || f.type === 'select'
      ? query.or(`${col}.is.null,${col}.eq.""`)
      : query.is(col, null);
  }
  if (c.op === 'not_empty') {
    let next = query.not(col, 'is', null);
    if (f.type === 'text' || f.type === 'select') next = next.neq(col, '');
    return next;
  }

  switch (f.type) {
    case 'text': {
      const t = likeText(value);
      if (!t) return query;
      if (c.op === 'contains') return query.ilike(col, `%${t}%`);
      if (c.op === 'is') return query.ilike(col, t);
      if (c.op === 'not_contains') return query.or(`${col}.is.null,${col}.not.ilike.%${t}%`);
      if (c.op === 'is_not') return query.or(`${col}.is.null,${col}.not.ilike.${q(t)}`);
      return query;
    }
    case 'select': {
      if (!values.length) return query;
      // Fresh leads often have no CRM result yet.
      const withNull = f.key === 'crm_status' && values.some((v) => v.toUpperCase() === 'FRESH');
      if (c.op === 'any_of') {
        if (f.partial) return query.or(values.map((v) => `${col}.ilike.%${likeText(v)}%`).join(','));
        if (withNull) return query.or(`${col}.is.null,${col}.in.(${values.map(q).join(',')})`);
        return query.in(col, values);
      }
      if (c.op === 'none_of') {
        if (f.partial) {
          let next = query;
          for (const v of values) next = next.or(`${col}.is.null,${col}.not.ilike.%${likeText(v)}%`);
          return next;
        }
        if (withNull) return query.not(col, 'is', null).not(col, 'in', `(${values.map(q).join(',')})`);
        return query.or(`${col}.is.null,${col}.not.in.(${values.map(q).join(',')})`);
      }
      return query;
    }
    case 'number': {
      const a = Number(c.value);
      const b = Number(c.extra?.to_value);
      if (c.op === 'eq' && Number.isFinite(a)) return query.eq(col, a);
      if (c.op === 'gt' && Number.isFinite(a)) return query.gt(col, a);
      if (c.op === 'lt' && Number.isFinite(a)) return query.lt(col, a);
      if (c.op === 'between') {
        let next = query;
        if (Number.isFinite(a)) next = next.gte(col, a);
        if (Number.isFinite(b)) next = next.lte(col, b);
        return next;
      }
      return query;
    }
    case 'date': {
      const r = resolveConditionRange(c);
      let next = query;
      if (r.from) next = next.gte(col, r.from);
      if (r.to) next = next.lte(col, r.to);
      return next;
    }
    case 'bool': {
      if (isBoolColumn(f)) {
        if (c.op === 'yes') return query.eq(col, true);
        if (c.op === 'no') return query.or(`${col}.is.null,${col}.eq.false`);
        return query;
      }
      const list = `(${TRUTHY.map(q).join(',')})`;
      if (c.op === 'yes') return query.in(col, TRUTHY);
      if (c.op === 'no') return query.or(`${col}.is.null,${col}.not.in.${list}`);
      return query;
    }
  }
  return query;
}

/** Embedded activity table: `has` → inner join, `has_not` → anti-join. */
function embed(
  query: any,
  c: LeadCondition,
  alias: string,
  table: string,
  selects: string[],
  aliases: string[],
  filters: (q: any) => any,
) {
  const has = c.op !== 'has_not';
  selects.push(`${alias}:${table}${has ? '!inner' : ''}(id)`);
  aliases.push(alias);
  const next = filters(query);
  return has ? next : next.is(alias, null);
}

function applyRange(query: any, col: string, c: LeadCondition) {
  const r = resolveConditionRange(c);
  let next = query;
  if (r.from) next = next.gte(col, r.from);
  if (r.to) next = next.lte(col, r.to);
  return next;
}

async function customApiLeadIds(db: any, c: LeadCondition): Promise<string[]> {
  let qy = db.from('crm_api_template_runs').select('lead_id').not('lead_id', 'is', null).neq('trigger', 'TEST');
  if (c.extra?.template) qy = qy.eq('template_id', c.extra.template);
  if (c.extra?.result === 'ok') qy = qy.eq('ok', true);
  if (c.extra?.result === 'failed') qy = qy.eq('ok', false);
  qy = applyRange(qy, 'created_at', c);
  const { data, error } = await qy.order('created_at', { ascending: false }).limit(2000);
  if (error) return [];
  return Array.from(new Set((data || []).map((r: any) => String(r.lead_id)).filter(Boolean)));
}

export async function buildLeadConditionPlan(db: any, conditions: LeadCondition[]): Promise<LeadConditionPlan> {
  const selects: string[] = [];
  const aliases: string[] = [];
  type Step = (query: any, sel: string[], al: string[]) => any;
  const steps: Step[] = [];

  for (let i = 0; i < conditions.length; i += 1) {
    const c = conditions[i];
    const alias = `_c${i}`;
    const field = FIELD_BY_KEY.get(c.key);
    if (field) {
      steps.push((query, sel, al) => applyField(query, c, field, alias, sel, al));
      continue;
    }
    const x = c.extra || {};
    switch (c.key) {
      case 'call':
        steps.push((query, sel, al) =>
          embed(query, c, alias, 'telecaller_call_logs', sel, al, (qq) => {
            let next = applyRange(qq, `${alias}.created_at`, c);
            if (x.status) next = next.eq(`${alias}.call_status`, x.status);
            if (x.by) next = next.eq(`${alias}.telecaller_id`, x.by);
            const min = Number(x.min_duration);
            if (Number.isFinite(min) && min > 0) next = next.gte(`${alias}.call_duration`, min);
            return next;
          }),
        );
        break;
      case 'task':
        steps.push((query, sel, al) =>
          embed(query, c, alias, 'telecaller_follow_ups', sel, al, (qq) => {
            let next = applyRange(qq, `${alias}.created_at`, c);
            if (x.status === 'OVERDUE') {
              next = next.eq(`${alias}.status`, 'PENDING').lt(`${alias}.scheduled_time`, new Date().toISOString());
            } else if (x.status) {
              next = next.eq(`${alias}.status`, x.status);
            }
            if (x.by) next = next.eq(`${alias}.telecaller_id`, x.by);
            return next;
          }),
        );
        break;
      case 'assignee_change':
        steps.push((query, sel, al) =>
          embed(query, c, alias, 'telecaller_lead_transfers', sel, al, (qq) => {
            let next = applyRange(qq, `${alias}.created_at`, c);
            if (x.to) next = next.eq(`${alias}.to_telecaller_id`, x.to);
            if (x.from_user) next = next.eq(`${alias}.from_telecaller_id`, x.from_user);
            return next;
          }),
        );
        break;
      case 'whatsapp': {
        const col = 'coupon_meta->>last_inbound_at';
        steps.push((query) => {
          const r = resolveConditionRange(c);
          if (c.op === 'has_not') {
            const parts = [`${col}.is.null`];
            if (r.from) parts.push(`${col}.lt.${r.from}`);
            if (r.to) parts.push(`${col}.gt.${r.to}`);
            return query.or(parts.join(','));
          }
          let next = query.not(col, 'is', null);
          if (r.from) next = next.gte(col, r.from);
          if (r.to) next = next.lte(col, r.to);
          return next;
        });
        break;
      }
      case 'note': {
        const col = 'coupon_meta->>telecaller_remarks';
        const text = likeText(c.value || '');
        steps.push((query) => {
          if (c.op === 'has_not') {
            return text ? query.or(`${col}.is.null,${col}.not.ilike.%${text}%`) : query.or(`${col}.is.null,${col}.eq.""`);
          }
          return text ? query.ilike(col, `%${text}%`) : query.not(col, 'is', null).neq(col, '');
        });
        break;
      }
      case 'status_change': {
        const codes = (c.values || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
        const path = 'coupon_meta->profile_history';
        steps.push((query) => {
          if (!codes.length) return query;
          if (c.op === 'has_not') {
            let next = query;
            for (const code of codes) next = next.not(path, 'cs', JSON.stringify([{ status: code }]));
            return next;
          }
          return query.or(codes.map((code) => `${path}.cs.${q(JSON.stringify([{ status: code }]))}`).join(','));
        });
        break;
      }
      case 'lead_merged': {
        const json = JSON.stringify([{ event: 'PHONE_DUPLICATE_MERGED' }]);
        steps.push((query) =>
          c.op === 'has_not'
            ? query.not('coupon_meta->profile_history', 'cs', json)
            : query.filter('coupon_meta->profile_history', 'cs', json),
        );
        break;
      }
      case 'custom_api': {
        const ids = await customApiLeadIds(db, c);
        steps.push((query) => {
          if (c.op === 'has_not') return ids.length ? query.not('id', 'in', `(${ids.join(',')})`) : query;
          return query.in('id', ids.length ? ids : [EMPTY_UUID]);
        });
        break;
      }
      default:
        break;
    }
  }

  // Dry run against a do-nothing query to learn which embeds the select() needs.
  const probe: any = new Proxy(
    {},
    {
      get: (_t, _prop, receiver) => () => receiver,
    },
  );
  for (const step of steps) step(probe, selects, aliases);
  const selectExtra = selects.length ? `, ${Array.from(new Set(selects)).join(', ')}` : '';

  return {
    select: selectExtra,
    aliases: Array.from(new Set(aliases)),
    apply: (query: any) => {
      let next = query;
      for (const step of steps) next = step(next, [], []);
      return next;
    },
  };
}

export function stripConditionKeys<T extends Record<string, any>>(rows: T[], aliases: string[]): T[] {
  if (!aliases.length) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const copy: Record<string, any> = { ...row };
    for (const a of aliases) delete copy[a];
    return copy as T;
  });
}
