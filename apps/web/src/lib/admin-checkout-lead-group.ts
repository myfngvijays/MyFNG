/**
 * Admin-only grouping for a checkout that created two service_leads
 * (package/service + split Custom Repair). Customer app still shows both orders.
 */

export type CheckoutLeadLike = {
  id?: string | null;
  lead_number?: string | null;
  customer_phone?: string | null;
  vehicle_number?: string | null;
  service_type?: string | null;
  service_display?: string | null;
  created_at?: string | null;
  meta?: unknown;
  estimated_amount?: unknown;
  actual_amount?: unknown;
  amount_display?: unknown;
};

export type CheckoutLeadIndex<T extends CheckoutLeadLike = CheckoutLeadLike> = {
  childToParentId: Map<string, string>;
  siblingsByParentId: Map<string, T[]>;
};

/** Same checkout is almost always the same minute; keep a short buffer. */
const CHECKOUT_WINDOW_MS = 20 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function checkoutPhoneKey(phone?: string | null): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function vehicleKey(value?: string | null): string {
  return String(value || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function createdMs(lead: CheckoutLeadLike): number {
  const ms = new Date(lead.created_at || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function isAdminCustomRepairLead(lead: CheckoutLeadLike | null | undefined): boolean {
  if (!lead) return false;
  const type = `${lead.service_type || ''} ${lead.service_display || ''}`;
  if (/custom repair/i.test(type)) return true;
  const meta = asRecord(lead.meta);
  return Boolean(meta?.custom_repair);
}

export function getSplitFromLeadNumber(lead: CheckoutLeadLike | null | undefined): string | null {
  const meta = asRecord(lead?.meta);
  const value = String(meta?.split_from_lead_number || '').trim();
  return value || null;
}

export function checkoutServiceName(lead: CheckoutLeadLike): string {
  const misa = checkoutMisaServices(lead);
  if (misa.length) return misa.map((row) => row.name).join(', ');
  return String(lead.service_display || lead.service_type || 'Service').trim() || 'Service';
}

export function checkoutLeadAmount(lead: CheckoutLeadLike): number {
  const n = Number(lead.amount_display ?? lead.estimated_amount ?? lead.actual_amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function checkoutMisaServices(lead: CheckoutLeadLike): Array<{ name: string; price: number }> {
  const meta = asRecord(lead.meta);
  const rows = Array.isArray(meta?.misa_services) ? meta.misa_services : [];
  return rows
    .map((service) => {
      const row = asRecord(service) || {};
      return {
        name: String(row.name || '').trim(),
        price: Number(row.price || 0),
      };
    })
    .filter((service) => service.name);
}

export type CheckoutServiceLine<T extends CheckoutLeadLike = CheckoutLeadLike> = {
  name: string;
  price: number;
  lead: T;
};

export function checkoutServiceLines<T extends CheckoutLeadLike>(
  primary: T,
  siblings: T[],
): CheckoutServiceLine<T>[] {
  const lines: CheckoutServiceLine<T>[] = [];
  const pushLead = (lead: T) => {
    const misa = checkoutMisaServices(lead);
    if (misa.length) {
      for (const service of misa) lines.push({ name: service.name, price: service.price, lead });
      return;
    }
    lines.push({ name: checkoutServiceName(lead), price: checkoutLeadAmount(lead), lead });
  };
  pushLead(primary);
  for (const sibling of siblings) pushLead(sibling);
  return lines;
}

export function checkoutCombinedServiceLabel<T extends CheckoutLeadLike>(primary: T, siblings: T[]): string {
  return checkoutServiceLines(primary, siblings)
    .map((line) => line.name)
    .join(', ');
}

export function checkoutCombinedAmount<T extends CheckoutLeadLike>(primary: T, siblings: T[]): number {
  return checkoutLeadAmount(primary) + siblings.reduce((sum, row) => sum + checkoutLeadAmount(row), 0);
}

export function buildCheckoutLeadIndex<T extends CheckoutLeadLike>(leads: T[]): CheckoutLeadIndex<T> {
  const childToParentId = new Map<string, string>();
  const siblingsByParentId = new Map<string, T[]>();
  const byLeadNumber = new Map<string, T>();

  for (const lead of leads) {
    const number = String(lead.lead_number || '').trim();
    if (number) byLeadNumber.set(number, lead);
  }

  for (const lead of leads) {
    if (!isAdminCustomRepairLead(lead)) continue;
    const childId = String(lead.id || '').trim();
    if (!childId) continue;
    const splitFrom = getSplitFromLeadNumber(lead);
    if (!splitFrom) continue;
    const parent = byLeadNumber.get(splitFrom);
    const parentId = String(parent?.id || '').trim();
    if (!parentId || parentId === childId) continue;
    childToParentId.set(childId, parentId);
  }

  const parents = leads.filter((lead) => !isAdminCustomRepairLead(lead));
  for (const child of leads) {
    const childId = String(child.id || '').trim();
    if (!childId || !isAdminCustomRepairLead(child) || childToParentId.has(childId)) continue;
    const phone = checkoutPhoneKey(child.customer_phone);
    if (phone.length !== 10) continue;
    const childTs = createdMs(child);
    const childVehicle = vehicleKey(child.vehicle_number);

    let best: T | null = null;
    let bestDist = Infinity;
    for (const parent of parents) {
      if (checkoutPhoneKey(parent.customer_phone) !== phone) continue;
      const parentVehicle = vehicleKey(parent.vehicle_number);
      if (childVehicle && parentVehicle && childVehicle !== parentVehicle) continue;
      const dist = Math.abs(createdMs(parent) - childTs);
      if (dist > CHECKOUT_WINDOW_MS) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = parent;
      }
    }
    const parentId = String(best?.id || '').trim();
    if (parentId && parentId !== childId) childToParentId.set(childId, parentId);
  }

  const byId = new Map(leads.map((lead) => [String(lead.id || ''), lead]));
  for (const [childId, parentId] of childToParentId) {
    const child = byId.get(childId);
    if (!child) continue;
    const list = siblingsByParentId.get(parentId) || [];
    list.push(child);
    siblingsByParentId.set(parentId, list);
  }

  return { childToParentId, siblingsByParentId };
}

export function collapseCheckoutChildLeads<T extends CheckoutLeadLike>(
  filtered: T[],
  allLoaded: T[] = filtered,
  index: CheckoutLeadIndex<T> = buildCheckoutLeadIndex(allLoaded),
): T[] {
  const byId = new Map(allLoaded.map((lead) => [String(lead.id || ''), lead]));
  const out: T[] = [];
  const seen = new Set<string>();

  for (const lead of filtered) {
    const id = String(lead.id || '');
    const parentId = index.childToParentId.get(id);
    const emit = (parentId && byId.get(parentId)) || lead;
    const emitId = String(emit.id || '');
    if (!emitId || seen.has(emitId)) continue;
    seen.add(emitId);
    out.push(emit);
  }

  return out;
}

export function resolveCheckoutPrimary<T extends CheckoutLeadLike>(
  lead: T,
  allLoaded: T[],
  index: CheckoutLeadIndex<T> = buildCheckoutLeadIndex(allLoaded),
): T {
  const parentId = index.childToParentId.get(String(lead.id || ''));
  if (!parentId) return lead;
  return allLoaded.find((row) => String(row.id) === parentId) || lead;
}

export function checkoutSiblingsFor<T extends CheckoutLeadLike>(
  lead: T,
  index: CheckoutLeadIndex<T>,
): T[] {
  const parent = index.childToParentId.get(String(lead.id || ''));
  const parentId = parent || String(lead.id || '');
  return index.siblingsByParentId.get(parentId) || [];
}
