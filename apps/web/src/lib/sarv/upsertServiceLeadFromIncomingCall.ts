import 'server-only';

import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';
import { appendLeadProfileHistory } from '@/lib/service-lead-reopen';
import { stampFreshCrmDisposition } from '@/lib/telecaller/freshLeadStatus';

export const INCOMING_SARV_LEAD_SOURCE = 'Incoming Sarv Call';

const OPEN_STATUSES = ['NEW', 'VALIDATED', 'HOLD', 'ACCEPTED', 'IN_PROGRESS', 'ASSIGNED'];

export type IncomingSarvLeadInput = {
  db: any;
  phone10: string;
  callid: string;
  ctype?: unknown;
  did?: string | null;
  talkDuration?: number | null;
  recordingUrl?: string | null;
  disposition?: string | null;
  assignedUserId?: string | null;
  assignedRole?: string | null;
};

export function isSarvOutgoingCall(ctype: unknown): boolean {
  const raw = String(ctype ?? '').trim().toLowerCase();
  if (!raw) return false;
  return (
    raw === '2' ||
    raw === 'ob' ||
    raw === 'c2c' ||
    /\bout/.test(raw) ||
    raw.includes('outgoing') ||
    raw.includes('outbound') ||
    raw.includes('click')
  );
}

/** Incoming / unknown (RSA webhook often omits ctype). Skip only clear outbound. */
export function isSarvIncomingCall(ctype: unknown): boolean {
  return !isSarvOutgoingCall(ctype);
}

function digits10(input: unknown): string {
  const d = String(input ?? '').replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

function isSarvStub(lead: Record<string, any> | null | undefined): boolean {
  if (!lead) return false;
  if (String(lead.lead_source || '').trim() === INCOMING_SARV_LEAD_SOURCE) return true;
  const meta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  return Boolean(meta.sarv_incoming);
}

async function lookupRsaProfile(db: any, phone10: string) {
  try {
    const { data } = await db
      .from('rsa_leads')
      .select('customer_name, pincode, vehicle_number, vehicle_model, contact_number')
      .ilike('contact_number', `%${phone10}`)
      .order('lead_registered_at', { ascending: false })
      .limit(5);
    const match = (data || []).find((row: any) => digits10(row?.contact_number) === phone10);
    if (!match) return null;
    return {
      name: String(match.customer_name || '').trim() || null,
      city: null as string | null,
      pincode: String(match.pincode || '').trim() || null,
      vehicleNumber: String(match.vehicle_number || '').trim() || null,
      vehicleModel: String(match.vehicle_model || '').trim() || null,
    };
  } catch {
    return null;
  }
}

/**
 * Create / attach a Bookings `service_leads` row for an incoming Sarv call
 * so it shows in Super Admin / Lead Manager Bookings and telecaller CRM (web + app).
 */
export async function upsertServiceLeadFromIncomingSarvCall(
  input: IncomingSarvLeadInput,
): Promise<{
  ok: boolean;
  created?: boolean;
  leadId?: string | null;
  skipped?: string;
  error?: string;
}> {
  const phone10 = digits10(input.phone10);
  if (phone10.length < 10) return { ok: false, skipped: 'invalid_phone' };
  if (!isSarvIncomingCall(input.ctype)) return { ok: false, skipped: 'not_incoming' };

  const db = input.db;
  if (!db) return { ok: false, error: 'no_db' };

  const nowIso = new Date().toISOString();
  const callid = String(input.callid || '').trim();
  const rsa = await lookupRsaProfile(db, phone10);
  const name = rsa?.name || `Call ${phone10.slice(-4)}`;

  const { data: byCallid } = callid
    ? await db
        .from('service_leads')
        .select('id, lead_number, status, coupon_meta, assigned_telecaller_id, customer_name, lead_source')
        .eq('coupon_meta->>sarv_callid', callid)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: openRows, error: findErr } = await db
    .from('service_leads')
    .select('id, lead_number, status, coupon_meta, assigned_telecaller_id, customer_name, lead_source')
    .or(`customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.ilike.%${phone10}`)
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);

  if (findErr) return { ok: false, error: findErr.message };

  // Only reuse an Incoming Sarv stub / same call. Do not hide this call
  // inside an old Website / App / MISA lead for the same phone.
  const existing = byCallid || (isSarvStub(openRows?.[0]) ? openRows[0] : null);

  let assignedTo: string | null = null;
  if (String(input.assignedRole || '').toUpperCase() === 'TELECALLER' && input.assignedUserId) {
    assignedTo = String(input.assignedUserId);
  } else {
    try {
      const picked = await pickTelecallerWeightedRoundRobin('MANUAL');
      assignedTo = picked.telecallerId || null;
    } catch (err) {
      console.warn('[sarv→service_leads] assignment failed', err);
    }
  }

  const callNote = [
    'Incoming Sarv call',
    callid ? `Call ID ${callid}` : null,
    input.did ? `DID ${input.did}` : null,
    Number(input.talkDuration) > 0 ? `${input.talkDuration}s` : null,
    input.disposition ? `Disp: ${input.disposition}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (existing?.id) {
    const prevMeta =
      existing.coupon_meta && typeof existing.coupon_meta === 'object'
        ? (existing.coupon_meta as Record<string, unknown>)
        : {};
    const prevAssignee = existing.assigned_telecaller_id
      ? String(existing.assigned_telecaller_id)
      : null;
    const nextAssignee = prevAssignee || assignedTo;
    const stub = isSarvStub(existing);

    const nextMeta = appendLeadProfileHistory(
      {
        ...prevMeta,
        ...(stub ? { sarv_incoming: true } : { last_sarv_attached: true }),
        sarv_callid: callid || prevMeta.sarv_callid || null,
        sarv_did: input.did || prevMeta.sarv_did || null,
        sarv_ctype: input.ctype != null ? String(input.ctype) : prevMeta.sarv_ctype || null,
        last_sarv_call_at: nowIso,
        recording_url: input.recordingUrl || prevMeta.recording_url || null,
        last_call_at: nowIso,
      },
      {
        at: nowIso,
        summary: callNote,
        status: String(existing.status || 'NEW'),
        event: 'SARV_INCOMING_CALL',
      },
    );

    const patch: Record<string, unknown> = {
      updated_at: nowIso,
      coupon_meta: nextMeta,
    };

    if (stub) {
      patch.lead_source = INCOMING_SARV_LEAD_SOURCE;
      patch.created_from = 'API';
      if (
        (!existing.customer_name || /^call\s*\d+/i.test(String(existing.customer_name))) &&
        name
      ) {
        patch.customer_name = name;
      }
      if (rsa?.city) patch.city = rsa.city;
      if (rsa?.pincode) patch.pincode = rsa.pincode;
      if (rsa?.vehicleNumber && rsa.vehicleNumber !== 'NA') patch.vehicle_number = rsa.vehicleNumber;
      if (rsa?.vehicleModel) patch.vehicle_model = rsa.vehicleModel;
    }

    if (nextAssignee && nextAssignee !== prevAssignee) {
      patch.assigned_telecaller_id = nextAssignee;
      patch.assigned_at = nowIso;
    }

    const { error: upErr } = await db.from('service_leads').update(patch).eq('id', existing.id);
    if (upErr) return { ok: false, error: upErr.message };

    if (nextAssignee && nextAssignee !== prevAssignee) {
      void notifyTelecallerNewLeadAssignedSafe({
        leadId: String(existing.id),
        leadNumber: existing.lead_number ? String(existing.lead_number) : null,
        telecallerId: nextAssignee,
        previousTelecallerId: prevAssignee,
        assignedByName: 'Incoming Sarv Call',
        notes: 'Incoming Sarv call',
      });
    }

    return { ok: true, created: false, leadId: String(existing.id) };
  }

  const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const payload: Record<string, unknown> = {
    lead_number: leadNumber,
    lead_type: 'NORMAL',
    lead_source: INCOMING_SARV_LEAD_SOURCE,
    created_from: 'API',
    status: 'NEW',
    customer_name: name,
    customer_phone: phone10,
    city: rsa?.city || null,
    pincode: rsa?.pincode || null,
    vehicle_number: rsa?.vehicleNumber || 'NA',
    vehicle_model: rsa?.vehicleModel || null,
    service_type: 'Incoming Call',
    description: callNote,
    problem_description: callNote,
    is_incomplete: true,
    assigned_telecaller_id: assignedTo,
    assigned_at: assignedTo ? nowIso : null,
    coupon_meta: stampFreshCrmDisposition(
      appendLeadProfileHistory(
        {
          sarv_incoming: true,
          sarv_callid: callid || null,
          sarv_did: input.did || null,
          sarv_ctype: input.ctype != null ? String(input.ctype) : null,
          last_sarv_call_at: nowIso,
          recording_url: input.recordingUrl || null,
          last_call_at: nowIso,
        },
        {
          at: nowIso,
          summary: callNote,
          status: 'NEW',
          event: 'SARV_INCOMING_CALL',
        },
      ),
    ),
    created_at: nowIso,
    updated_at: nowIso,
  };

  let { data: inserted, error: insertErr } = await db
    .from('service_leads')
    .insert([payload])
    .select('id')
    .maybeSingle();

  if (insertErr && /is_incomplete|assigned_at|description|created_from/i.test(insertErr.message || '')) {
    const slim = { ...payload };
    delete slim.is_incomplete;
    delete slim.assigned_at;
    delete slim.description;
    slim.created_from = 'API';
    ({ data: inserted, error: insertErr } = await db
      .from('service_leads')
      .insert([slim])
      .select('id')
      .maybeSingle());
  }

  if (insertErr) return { ok: false, error: insertErr.message };

  if (inserted?.id && assignedTo) {
    void notifyTelecallerNewLeadAssignedSafe({
      leadId: String(inserted.id),
      leadNumber,
      telecallerId: assignedTo,
      assignedByName: 'Incoming Sarv Call',
      notes: 'Incoming Sarv call',
    });
  }

  return {
    ok: true,
    created: true,
    leadId: inserted?.id ? String(inserted.id) : null,
  };
}
