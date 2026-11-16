/**
 * A lead is a repeat customer when this phone already had a finished service
 * before this lead was created. TeleCRM's Repeat Customer checkbox maps to the same idea.
 */

export type RepeatPrior = {
  id: string;
  phone: string;
  created_at: string | null;
  service_at: string | null;
  remark: string;
};

export type RepeatCustomerFlag = {
  repeat_customer: boolean;
  repeat_remark: string | null;
};

const CACHE_MS = 60_000;
let cache: { at: number; byPhone: Map<string, RepeatPrior[]> } | null = null;

export function repeatPhoneKey(phone: unknown): string {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? digits : '';
}

function metaOf(lead: Record<string, any> | null | undefined) {
  return lead?.coupon_meta && typeof lead.coupon_meta === 'object' && !Array.isArray(lead.coupon_meta)
    ? (lead.coupon_meta as Record<string, any>)
    : {};
}

export function leadWasServiced(lead: Record<string, any> | null | undefined): boolean {
  if (!lead) return false;
  if (String(lead.status || '').toUpperCase() === 'COMPLETED') return true;
  const meta = metaOf(lead);
  if (String(meta.last_call_result || '').toUpperCase() === 'SERVICE_DONE') return true;
  return Boolean(String(meta.service_done_at || '').trim());
}

function truthyRepeat(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  return raw === 'yes' || raw === 'true' || raw === '1' || raw === 'checked';
}

export function importedRepeatChecked(lead: Record<string, any> | null | undefined): boolean {
  if (truthyRepeat(metaOf(lead).repeat_customer)) return true;
  const bag = lead?.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, any>) : {};
  const imported =
    bag.import_fields && typeof bag.import_fields === 'object'
      ? (bag.import_fields as Record<string, any>)
      : {};
  return truthyRepeat(imported['Repeat Customer'] || bag.repeat_customer);
}

function serviceAt(lead: Record<string, any>): string | null {
  const meta = metaOf(lead);
  const raw = meta.service_done_at || lead.completed_at || null;
  return raw ? String(raw) : null;
}

function remarkText(lead: Record<string, any>, when: string | null): string {
  const meta = metaOf(lead);
  let date = '';
  if (when) {
    const parsed = new Date(when);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  const note = String(meta.telecaller_remarks || lead.problem_description || meta.feedback || '')
    .replace(/\s+/g, ' ')
    .trim();
  const vehicle = String(lead.vehicle_number || '').trim();
  return [date ? `Last service ${date}` : 'Last service', vehicle, note].filter(Boolean).join(' · ').slice(0, 280);
}

function toPrior(lead: Record<string, any>): RepeatPrior | null {
  const phone = repeatPhoneKey(lead.customer_phone);
  if (!phone || !leadWasServiced(lead)) return null;
  const when = serviceAt(lead);
  return {
    id: String(lead.id),
    phone,
    created_at: lead.created_at ? String(lead.created_at) : null,
    service_at: when,
    remark: remarkText(lead, when || lead.completed_at || lead.created_at),
  };
}

export function matchRepeatCustomer(current: Record<string, any>, priors: RepeatPrior[]): RepeatCustomerFlag {
  const start = new Date(current?.created_at || 0).getTime();
  const earlier = priors
    .filter((row) => row.id !== String(current?.id || ''))
    .filter((row) => {
      const serviced = new Date(row.service_at || row.created_at || 0).getTime();
      return Number.isFinite(start) && serviced > 0 && serviced <= start;
    })
    .sort(
      (a, b) =>
        new Date(b.service_at || b.created_at || 0).getTime() -
        new Date(a.service_at || a.created_at || 0).getTime(),
    );
  const prior = earlier[0];
  if (!prior && !importedRepeatChecked(current)) {
    return { repeat_customer: false, repeat_remark: null };
  }
  return {
    repeat_customer: true,
    repeat_remark: prior?.remark || 'Marked repeat customer',
  };
}

async function loadServicedByPhone(db: any): Promise<Map<string, RepeatPrior[]>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byPhone;
  const byPhone = new Map<string, RepeatPrior[]>();
  const pageSize = 1000;
  let failed = false;
  for (let page = 0; page < 20; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let query = db
      .from('service_leads')
      .select('id, customer_phone, status, created_at, completed_at, problem_description, vehicle_number, coupon_meta')
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false })
      .range(from, to);
    query = query.is('deleted_at', null);
    let { data, error } = await query;
    if (error && /deleted_at/i.test(String(error.message || ''))) {
      ({ data, error } = await db
        .from('service_leads')
        .select('id, customer_phone, status, created_at, completed_at, problem_description, vehicle_number, coupon_meta')
        .eq('status', 'COMPLETED')
        .order('completed_at', { ascending: false })
        .range(from, to));
    }
    if (error) {
      failed = true;
      break;
    }
    const rows = data || [];
    for (const row of rows) {
      const prior = toPrior(row);
      if (!prior) continue;
      const list = byPhone.get(prior.phone) || [];
      list.push(prior);
      byPhone.set(prior.phone, list);
    }
    if (rows.length < pageSize) break;
  }
  if (!failed) cache = { at: Date.now(), byPhone };
  return byPhone;
}

export async function attachRepeatCustomerFlags<T extends Record<string, any>>(db: any, leads: T[]): Promise<T[]> {
  if (!leads.length) return leads;
  let byPhone = new Map<string, RepeatPrior[]>();
  try {
    byPhone = await loadServicedByPhone(db);
  } catch (err) {
    console.warn('[repeatCustomer] lookup skipped', err);
  }
  const extra = new Map<string, RepeatPrior[]>();
  for (const lead of leads) {
    const prior = toPrior(lead);
    if (!prior) continue;
    const list = extra.get(prior.phone) || [];
    list.push(prior);
    extra.set(prior.phone, list);
  }
  return leads.map((lead) => {
    const phone = repeatPhoneKey(lead.customer_phone);
    const priors = phone ? [...(byPhone.get(phone) || []), ...(extra.get(phone) || [])] : [];
    return { ...lead, ...matchRepeatCustomer(lead, priors) };
  });
}
