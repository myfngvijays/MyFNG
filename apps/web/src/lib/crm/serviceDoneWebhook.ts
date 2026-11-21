import 'server-only';
import { importedRepeatChecked } from '@/lib/crm/repeatCustomer';
import { hasApiTemplate, normalizeCrmResult, runApiTemplatesForStatusChange } from '@/lib/crm/apiTemplates';

/**
 * Lead marked "Service Done" → POST it to the workshop-leads panel on the website
 * (same endpoint + JSON as TeleCRM's "Workshop-leads" API template).
 *
 * Fallback only: once a "Service Done" template exists in Settings → API Templates, that is used
 * instead and these env vars are not needed.
 *
 * Env:
 *   WORKSHOP_LEAD_API_URL    default https://www.myfngautocare.com/admin/telecrmapi/workshop-lead.php
 *   WORKSHOP_LEAD_API_TOKEN  Bearer token (same as in the TeleCRM template). Not set → nothing is sent.
 *
 * Fire-and-forget from the save routes: never blocks or fails a status save.
 * Result is stamped on the lead (coupon_meta.service_done_api_*), which also stops double sends.
 */

const DEFAULT_URL = 'https://www.myfngautocare.com/admin/telecrmapi/workshop-lead.php';
const TIMEOUT_MS = 10_000;
/** Two save paths can fire for one click; ignore a second send within this window. */
const DEDUPE_MS = 5 * 60_000;

export function isServiceDoneResult(value: unknown): boolean {
  const v = String(value || '').trim().toUpperCase();
  return v === 'SERVICE_DONE' || v === 'COMPLETED';
}

/** True when this save moved the lead into Service Done. */
export function becameServiceDone(prevResult: unknown, nextResult: unknown): boolean {
  return isServiceDoneResult(nextResult) && !isServiceDoneResult(prevResult);
}

function istDateTime(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(',', '');
}

function str(v: unknown) {
  return String(v ?? '').trim();
}

function phone10(v: unknown) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

function appUrl() {
  return (
    str(process.env.NEXT_PUBLIC_APP_URL) ||
    str(process.env.NEXT_PUBLIC_SITE_URL) ||
    'https://myfng.in'
  ).replace(/\/+$/, '');
}

/** Same keys as the TeleCRM "Workshop-leads" template payload. */
export function buildWorkshopLeadPayload(
  lead: Record<string, any>,
  opts: { workshopName?: string | null; assigneeEmail?: string | null; actorName?: string | null },
) {
  const meta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const address =
    str(lead.customer_address) ||
    str(lead.pickup_address) ||
    [meta.flat_number, meta.area, meta.landmark, lead.city, lead.pincode].map(str).filter(Boolean).join(', ');
  const model = [lead.vehicle_make, lead.vehicle_model]
    .map(str)
    .filter((v) => v && v.toUpperCase() !== 'NA')
    .join(' ');
  const carNo = str(lead.vehicle_number);
  const doneAt = new Date();
  return {
    lead_phone: phone10(lead.customer_phone),
    lead_person_name: str(lead.customer_name),
    workshop: str(opts.workshopName),
    package: str(lead.service_type) || str(meta.vehicle_class),
    pickupvisit: lead.pickup_required ? 'Pickup' : 'Visit',
    remark: str(meta.telecaller_remarks) || str(lead.notes),
    model,
    carno: carNo.toUpperCase() === 'NA' ? '' : carNo.toUpperCase(),
    address,
    plan: str(meta.plan || meta.membership_plan || meta.plan_name),
    status: 'Service Done',
    lead_link: `${appUrl()}/dashboard/super_admin/bookings?lead=${encodeURIComponent(str(lead.lead_number) || str(lead.id))}`,
    service_done: istDateTime(doneAt),
    system_note: `Service Done${opts.actorName ? ` by ${opts.actorName}` : ''} · MyFNG ${str(lead.lead_number)}`.trim(),
    employe: str(opts.assigneeEmail),
    repeat_customer: importedRepeatChecked(lead) ? 'Yes' : 'No',
  };
}

export async function sendServiceDoneToWorkshopPanel(
  db: any,
  leadId: string,
  opts: { actorName?: string | null } = {},
): Promise<{ ok: boolean; skipped?: string; error?: string; status?: number }> {
  const token = str(process.env.WORKSHOP_LEAD_API_TOKEN);
  if (!token) return { ok: false, skipped: 'WORKSHOP_LEAD_API_TOKEN not set' };
  const url = str(process.env.WORKSHOP_LEAD_API_URL) || DEFAULT_URL;

  const { data: lead, error } = await db
    .from('service_leads')
    .select(
      `id, lead_number, customer_name, customer_phone, customer_address, pickup_address, pickup_required,
       city, pincode, vehicle_make, vehicle_model, vehicle_number, service_type, notes, status, meta, coupon_meta,
       workshop_id, assigned_telecaller_id`,
    )
    .eq('id', leadId)
    .maybeSingle();
  if (error || !lead) return { ok: false, error: error?.message || 'lead not found' };

  const meta: Record<string, any> =
    lead.coupon_meta && typeof lead.coupon_meta === 'object' ? { ...lead.coupon_meta } : {};
  if (!isServiceDoneResult(meta.last_call_result) && !isServiceDoneResult(lead.status)) {
    return { ok: false, skipped: 'lead is not Service Done' };
  }
  const lastSent = Date.parse(str(meta.service_done_api_at));
  if (Number.isFinite(lastSent) && Date.now() - lastSent < DEDUPE_MS) {
    return { ok: true, skipped: 'already sent' };
  }

  const [ws, tc] = await Promise.all([
    lead.workshop_id
      ? db.from('workshops').select('name').eq('id', lead.workshop_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lead.assigned_telecaller_id
      ? db.from('users_login').select('email').eq('id', lead.assigned_telecaller_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const payload = buildWorkshopLeadPayload(lead, {
    workshopName: ws?.data?.name || null,
    assigneeEmail: tc?.data?.email || null,
    actorName: opts.actorName || null,
  });

  // Claim the send first so a parallel save path does not post it twice.
  const nowIso = new Date().toISOString();
  await db
    .from('service_leads')
    .update({ coupon_meta: { ...meta, service_done_api_at: nowIso, service_done_api_error: null } })
    .eq('id', leadId);

  let result: { ok: boolean; error?: string; status?: number };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const text = await res.text().catch(() => '');
    result = res.ok
      ? { ok: true, status: res.status }
      : { ok: false, status: res.status, error: `HTTP ${res.status} ${text.slice(0, 200)}`.trim() };
  } catch (e: any) {
    result = { ok: false, error: e?.name === 'AbortError' ? 'timeout' : e?.message || 'request failed' };
  }

  // Record the outcome (re-read meta so we do not clobber edits made meanwhile).
  try {
    const { data: fresh } = await db.from('service_leads').select('coupon_meta').eq('id', leadId).maybeSingle();
    const freshMeta: Record<string, any> =
      fresh?.coupon_meta && typeof fresh.coupon_meta === 'object' ? { ...fresh.coupon_meta } : {};
    freshMeta.service_done_api_at = result.ok ? nowIso : null; // failed → allow a retry on next save
    freshMeta.service_done_api_status = result.status ?? null;
    freshMeta.service_done_api_error = result.ok ? null : result.error || 'failed';
    if (result.ok) freshMeta.service_done_api_sent_at = nowIso;
    await db.from('service_leads').update({ coupon_meta: freshMeta }).eq('id', leadId);
  } catch {
    /* stamp is best-effort */
  }

  if (!result.ok) console.warn('[service-done webhook] failed', leadId, result.error);
  return result;
}

/**
 * Fire-and-forget from every lead save path: the lead moved prev → next.
 * Runs the API Templates set up in the panel for `next`. For Service Done, when no
 * template exists yet (or the table is not created), falls back to the env-configured
 * workshop-leads sender above.
 */
export function queueLeadStatusApis(
  db: any,
  leadId: string,
  prevResult: unknown,
  nextResult: unknown,
  actorName?: string | null,
) {
  const prev = normalizeCrmResult(prevResult);
  const next = normalizeCrmResult(nextResult);
  if (!next || prev === next) return;
  void (async () => {
    const matched = await runApiTemplatesForStatusChange(db, leadId, prev, next, { name: actorName || null });
    // Env fallback only while no Service Done template is set up at all.
    // A template switched OFF means "send nothing".
    if (!matched && becameServiceDone(prev, next) && !(await hasApiTemplate(db, 'SERVICE_DONE'))) {
      await sendServiceDoneToWorkshopPanel(db, leadId, { actorName });
    }
  })().catch((e) => console.warn('[lead-status apis] error', leadId, e?.message || e));
}
