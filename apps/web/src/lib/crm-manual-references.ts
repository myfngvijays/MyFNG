import { parseReferredBy, type CrmReferredBy } from '@/lib/telecaller/crmLeadReference';

export type CrmManualReferenceRow = {
  lead_id: string;
  lead_number: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  referred_by: CrmReferredBy;
  telecaller_id: string | null;
  telecaller_name: string | null;
};

const LEAD_REF_COLS =
  'id, lead_number, customer_name, customer_phone, created_at, coupon_meta, assigned_telecaller_id, created_by_id, status, city, updated_at';

function last10(phone: string | null | undefined) {
  return String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);
}

async function telecallerNamesById(supabaseAdmin: any, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (!uniq.length) return map;
  const { data } = await supabaseAdmin.from('users_login').select('id, full_name').in('id', uniq);
  for (const row of data || []) {
    const name = String(row.full_name || '').trim();
    if (name) map.set(String(row.id), name);
  }
  return map;
}

function toRow(lead: any, referredBy: CrmReferredBy, names: Map<string, string>): CrmManualReferenceRow {
  const assigned = String(lead.assigned_telecaller_id || '').trim();
  const createdBy = String(lead.created_by_id || '').trim();
  const teleId = assigned || createdBy || null;
  return {
    lead_id: String(lead.id),
    lead_number: lead.lead_number ? String(lead.lead_number) : null,
    created_at: lead.created_at,
    customer_name: lead.customer_name || null,
    customer_phone: lead.customer_phone || null,
    referred_by: referredBy,
    telecaller_id: teleId,
    telecaller_name: (assigned && names.get(assigned)) || (createdBy && names.get(createdBy)) || null,
  };
}

function matchesReferrer(
  parsed: CrmReferredBy,
  opts: { phone: string; customerId: string; leadIds: Set<string> },
) {
  if (opts.phone && last10(parsed.customer_phone) === opts.phone) return true;
  if (opts.customerId && parsed.customer_id === opts.customerId) return true;
  if (parsed.lead_id && opts.leadIds.has(parsed.lead_id)) return true;
  return false;
}

async function selectLeads(
  db: any,
  apply: (q: any) => any,
): Promise<{ rows: any[]; ok: boolean }> {
  const start = (withDeleted: boolean) => {
    let q = db
      .from('service_leads')
      .select(LEAD_REF_COLS)
      .order('created_at', { ascending: false });
    if (withDeleted) q = q.is('deleted_at', null);
    return apply(q);
  };
  const first = await start(true);
  if (!first?.error) return { rows: first?.data || [], ok: true };
  const retry = await start(false);
  if (!retry?.error) return { rows: retry?.data || [], ok: true };
  return { rows: [], ok: false };
}

/**
 * Leads where this person was tagged as the telecaller “Referred by”
 * (phone, app customer id, or any of their CRM lead ids).
 */
export async function findLeadsReferredByPerson(
  db: any,
  opts: {
    phone?: string | null;
    customerId?: string | null;
    leadIds?: string[];
    excludeLeadIds?: string[];
    limit?: number;
  },
): Promise<any[]> {
  const phone = last10(opts.phone);
  const customerId = String(opts.customerId || '').trim();
  const leadIds = [...new Set((opts.leadIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const exclude = new Set((opts.excludeLeadIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const limit = Math.min(Math.max(opts.limit || 40, 1), 80);
  const leadIdSet = new Set(leadIds);

  if (!phone && !customerId && !leadIds.length) return [];

  const seen = new Set<string>();
  const results: any[] = [];

  const ingest = (rows: any[] | null | undefined) => {
    for (const row of rows || []) {
      const id = String(row.id || '');
      if (!id || seen.has(id) || exclude.has(id) || leadIdSet.has(id)) continue;
      const parsed = parseReferredBy(row.coupon_meta);
      if (!parsed) continue;
      if (!matchesReferrer(parsed, { phone, customerId, leadIds: leadIdSet })) continue;
      seen.add(id);
      results.push(row);
    }
  };

  const queries: Promise<{ rows: any[]; ok: boolean }>[] = [];

  if (phone.length === 10) {
    queries.push(
      selectLeads(db, (q: any) =>
        q.contains('coupon_meta', { referred_by: { customer_phone: phone } }).limit(50),
      ),
    );
    queries.push(
      selectLeads(db, (q: any) =>
        q.filter('coupon_meta->referred_by->>customer_phone', 'ilike', `%${phone}%`).limit(50),
      ),
    );
  }
  if (customerId) {
    queries.push(
      selectLeads(db, (q: any) =>
        q.contains('coupon_meta', { referred_by: { customer_id: customerId } }).limit(50),
      ),
    );
  }
  for (const id of leadIds.slice(0, 8)) {
    queries.push(
      selectLeads(db, (q: any) =>
        q.contains('coupon_meta', { referred_by: { lead_id: id } }).limit(50),
      ),
    );
  }

  const batches = await Promise.all(queries);
  let anyOk = false;
  for (const batch of batches) {
    if (batch.ok) anyOk = true;
    ingest(batch.rows);
  }

  if (!anyOk) {
    const scanned = await selectLeads(db, (q: any) =>
      q.not('coupon_meta', 'is', null).limit(800),
    );
    ingest(scanned.rows);
  }

  results.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return results.slice(0, limit);
}

/** Recent CRM leads tagged with telecaller “Referred by” (manual, not app Refer & Rise). */
export async function loadCrmManualReferences(
  supabaseAdmin: any,
  opts?: { limit?: number },
): Promise<CrmManualReferenceRow[]> {
  const limit = Math.min(Math.max(opts?.limit || 80, 1), 200);
  const { rows: leadRows } = await selectLeads(supabaseAdmin, (q: any) =>
    q.not('coupon_meta', 'is', null).limit(800),
  );

  const matched: { lead: any; referred_by: CrmReferredBy }[] = [];
  for (const lead of leadRows || []) {
    const referredBy = parseReferredBy(lead.coupon_meta);
    if (!referredBy) continue;
    matched.push({ lead, referred_by: referredBy });
    if (matched.length >= limit) break;
  }

  const names = await telecallerNamesById(
    supabaseAdmin,
    matched.flatMap(({ lead }) => [lead.assigned_telecaller_id, lead.created_by_id]),
  );

  return matched.map(({ lead, referred_by }) => toRow(lead, referred_by, names));
}

export async function loadCrmManualReferencesForCustomer(
  supabaseAdmin: any,
  opts: { leads: any[]; phone?: string | null; customerId?: string | null },
): Promise<{
  referred_by: CrmReferredBy | null;
  telecallers: { id: string; name: string }[];
  references_given: CrmManualReferenceRow[];
}> {
  const leads = Array.isArray(opts.leads) ? opts.leads : [];
  const phone = last10(opts.phone);
  const customerId = String(opts.customerId || '').trim();
  const myLeadIds = [...new Set(leads.map((l) => String(l.id || '')).filter(Boolean))];

  let referredBy: CrmReferredBy | null = null;
  const teleIds: string[] = [];
  for (const lead of leads) {
    const assigned = String(lead.assigned_telecaller_id || '').trim();
    const createdBy = String(lead.created_by_id || '').trim();
    if (assigned) teleIds.push(assigned);
    else if (createdBy) teleIds.push(createdBy);
    if (!referredBy) {
      const parsed = parseReferredBy(lead.coupon_meta);
      if (parsed) referredBy = parsed;
    }
  }

  const names = await telecallerNamesById(supabaseAdmin, teleIds);
  const telecallers = [...new Set(teleIds)]
    .map((id) => ({ id, name: names.get(id) || '' }))
    .filter((t) => t.name);

  const givenLeads = await findLeadsReferredByPerson(supabaseAdmin, {
    phone,
    customerId,
    leadIds: myLeadIds,
    excludeLeadIds: myLeadIds,
    limit: 40,
  });

  const givenIds = givenLeads.flatMap((lead) => [lead.assigned_telecaller_id, lead.created_by_id]);
  const givenNames = await telecallerNamesById(supabaseAdmin, givenIds);
  const given: CrmManualReferenceRow[] = [];
  for (const lead of givenLeads) {
    const parsed = parseReferredBy(lead.coupon_meta);
    if (!parsed) continue;
    given.push(toRow(lead, parsed, givenNames));
  }

  return { referred_by: referredBy, telecallers, references_given: given };
}
