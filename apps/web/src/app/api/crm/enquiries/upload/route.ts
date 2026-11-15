import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { addLeadTags, ensureTagIdsByNames } from '@/lib/telecaller/crmLeadTagsApply';
import { appendLeadProfileHistory } from '@/lib/service-lead-reopen';
import { ensureCsvAssigneeUserId, matchWorkshopId } from '@/lib/crm/ensureCsvAssignee';
import {
  enrichEnquiryMakes,
  enrichEnquiryTags,
  isValidEnquiryPhone,
  mapEnquiryCsvRows,
  mapTelecrmLostReason,
  normalizePhoneDigits,
  parseEnquiryActivities,
  parseLeadTagTokens,
  primaryLeadSourceFromTags,
} from '@/lib/crm/normalizeEnquiryCsv';
import { patchEnquiryUploadJob, readEnquiryUploadJob, writeEnquiryUploadJob } from '@/lib/crm/enquiryUploadJob';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function toTimestamptz(val: any): string | null {
  const s = String(val || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  return null;
}

function looksLikeLeadNumber(value: string): boolean {
  return /^L[-_][A-Z0-9]+/i.test(String(value || '').trim());
}

function parseImportFields(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function fieldText(fields: Record<string, string>, label: string): string {
  return String(fields[label] || '').trim();
}

function fieldNumber(fields: Record<string, string>, label: string): number | null {
  const raw = fieldText(fields, label).replace(/[,₹rs\s]/gi, '');
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

async function loadExistingByPhone(writer: any, phones: string[]) {
  const unique = [...new Set(phones.map((phone) => normalizePhoneDigits(phone)).filter(Boolean))];
  const map = new Map<string, any>();
  const take = (rows: any[]) => {
    for (const row of rows || []) {
      const key = normalizePhoneDigits(String(row?.customer_phone || ''));
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || String(row.created_at || '') < String(prev.created_at || '')) map.set(key, row);
    }
  };
  for (let i = 0; i < unique.length; i += 150) {
    const batch = unique.slice(i, i + 150);
    const variants = [...batch, ...batch.map((phone) => `91${phone}`), ...batch.map((phone) => `+91${phone}`)];
    let query = writer
      .from('service_leads')
      .select(
        'id, lead_number, status, coupon_meta, meta, assigned_telecaller_id, customer_name, customer_phone, customer_address, address, vehicle_number, vehicle_make, vehicle_model, service_type, description, problem_description, lead_type, lead_source, lead_priority, created_from, created_at, next_follow_up_at, pickup_required, workshop_id',
      )
      .in('customer_phone', variants);
    query = query.is('deleted_at', null);
    let { data, error } = await query;
    if (error && /deleted_at/i.test(String(error.message || ''))) {
      const retry = await writer
        .from('service_leads')
        .select(
          'id, lead_number, status, coupon_meta, meta, assigned_telecaller_id, customer_name, customer_phone, created_at, next_follow_up_at',
        )
        .in('customer_phone', variants);
      data = retry.data;
      error = retry.error;
    }
    if (!error) take(data || []);
  }
  return map;
}

async function runEnquiryUpload(
  rows: Record<string, any>[] | undefined,
  overwrite: boolean,
  onProgress?: (patch: { done: number; total: number; inserted: number; updated: number }) => void,
) {
  try {

    if (!Array.isArray(rows) || rows.length === 0) {
      return { status: 400, body: { error: 'No rows provided' } };
    }

    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const writer = supabaseAdmin || supabase;

    const asStrings = rows.map((r) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(r || {})) out[k] = v == null ? '' : String(v);
      return out;
    });

    const [{ data: tagRows }, { data: lostRows }, { data: workshopRows }] = await Promise.all([
      writer.from('crm_lead_tags').select('name'),
      writer.from('crm_lost_reasons').select('name'),
      writer.from('workshops').select('id, name, workshop_name, workshop_area, city').limit(800),
    ]);
    const catalogTags = (tagRows || []).map((t: any) => String(t.name || '').trim()).filter(Boolean);
    const lostCatalog = (lostRows || []).map((t: any) => String(t.name || '').trim()).filter(Boolean);
    const workshops = workshopRows || [];

    let mapped = mapEnquiryCsvRows(asStrings, catalogTags);
    mapped = await enrichEnquiryMakes(mapped, async () => {
      const { data } = await writer.from('car_models').select('make, model_name').eq('is_active', true);
      return data || [];
    });
    mapped = await enrichEnquiryTags(mapped, async () => catalogTags);

    const valid = mapped
      .map((r) => ({
        ...r,
        phone_no: normalizePhoneDigits(r.phone_no || ''),
        alternate_phone: normalizePhoneDigits(r.alternate_phone || ''),
        lost_reason: mapTelecrmLostReason(r.lost_reason || '', lostCatalog),
        created_at: toTimestamptz(r.created_at) || '',
        updated_at: toTimestamptz(r.updated_at) || '',
        next_followup_at: toTimestamptz(r.next_followup_at) || '',
      }))
      .filter((r) => isValidEnquiryPhone(r.phone_no));

    if (valid.length === 0) {
      return {
        status: 400,
        body: { error: 'No valid 10-digit mobile numbers. Use 10 digits starting 6-9, or 91 + 10 digits.' },
      };
    }

    if (!writer) {
      return { status: 500, body: { error: adminError || 'Could not write Bookings leads' } };
    }

    const existingByPhone = await loadExistingByPhone(
      writer,
      valid.map((row) => row.phone_no),
    );
    const assigneeCache = new Map<string, { id: string | null; created: boolean; name: string }>();
    const createdAssignees: string[] = [];
    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;
    let reminders = 0;

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      const nowIso = new Date().toISOString();
      const createdAt = r.created_at || nowIso;
      const updatedAt = r.updated_at || nowIso;
      const tags = parseLeadTagTokens(r.lead_tags || '');
      const leadSource = primaryLeadSourceFromTags(r.lead_tags || '');
      const pickupRequired = r.pickup_required === 'true' || /^pickup$/i.test(r.pickup_visit || '');
      const hasCrmStatus = Boolean(r.crm_status);
      const crmStatus = r.crm_status || '';
      const crmLabel = hasCrmStatus
        ? crmStatus === 'LOST' && r.lost_reason
          ? `Lost · ${r.lost_reason}`
          : r.crm_status_label || r.disposition || 'Fresh'
        : '';
      const pipeline = hasCrmStatus ? r.crm_pipeline || (crmStatus === 'LOST' ? 'REJECTED' : 'NEW') : '';
      const workshopId = r.workshop ? matchWorkshopId(r.workshop, workshops) : null;

      const assigneeName = String(r.assignee_name || '').trim();
      const assigneeLooksReal = Boolean(assigneeName) && !assigneeName.startsWith('@') && !/bulk-messaging/i.test(assigneeName);
      const assigneeKey = `${String(r.assignee_email || '').toLowerCase()}|${assigneeName.toLowerCase()}`;
      let assignee = assigneeCache.get(assigneeKey);
      if (!assignee && (assigneeLooksReal || r.assignee_email)) {
        assignee = await ensureCsvAssigneeUserId(writer, {
          name: r.assignee_name,
          email: r.assignee_email,
        });
        assigneeCache.set(assigneeKey, assignee);
        if (assignee.created && assignee.name) createdAssignees.push(assignee.name);
      }

      const activities = parseEnquiryActivities(r.activities_json || '');
      const existing = existingByPhone.get(normalizePhoneDigits(r.phone_no)) || null;
      if (existing?.id && !overwrite) continue;
      const imported = parseImportFields(r.import_fields || '');
      const prevMeta =
        existing?.coupon_meta && typeof existing.coupon_meta === 'object' && !Array.isArray(existing.coupon_meta)
          ? { ...existing.coupon_meta }
          : {};
      const prevLeadMeta =
        existing?.meta && typeof existing.meta === 'object' && !Array.isArray(existing.meta)
          ? { ...existing.meta }
          : {};

      const prevImport =
        prevLeadMeta.import_fields && typeof prevLeadMeta.import_fields === 'object'
          ? prevLeadMeta.import_fields
          : {};
      let couponMeta: Record<string, unknown> = {
        ...prevMeta,
        telecrm_csv: true,
        ...(hasCrmStatus
          ? {
              last_call_result: crmStatus,
              last_call_label: crmLabel,
              last_call_at: updatedAt,
              last_lost_reason:
                crmStatus === 'LOST' ? r.lost_reason || 'Other Reasons' : prevMeta.last_lost_reason || null,
              telecrm_status: r.disposition || null,
            }
          : {}),
        ...(r.user_note || fieldText(imported, 'Remark Cordinator')
          ? { telecaller_remarks: r.user_note || fieldText(imported, 'Remark Cordinator') }
          : {}),
        ...(fieldText(imported, 'UTM Source') ? { utm_source: fieldText(imported, 'UTM Source') } : {}),
        ...(fieldText(imported, 'UTM Medium') ? { utm_medium: fieldText(imported, 'UTM Medium') } : {}),
        ...(fieldText(imported, 'UTM Campaign') ? { utm_campaign: fieldText(imported, 'UTM Campaign') } : {}),
        ...(fieldText(imported, 'Message') ? { inbound_message: fieldText(imported, 'Message') } : {}),
        ...(fieldText(imported, 'Rating') ? { rating: fieldText(imported, 'Rating') } : {}),
        ...(fieldText(imported, 'FEEDBACK') ? { feedback: fieldText(imported, 'FEEDBACK') } : {}),
      };

      for (const activity of activities) {
        couponMeta = appendLeadProfileHistory(couponMeta, {
          at: activity.at || updatedAt,
          summary: activity.by ? `${activity.by} — TeleCRM note` : 'TeleCRM customer activity',
          remark: activity.remark,
          status: crmStatus,
          event: 'telecrm_note',
          lost_reason: crmStatus === 'LOST' ? r.lost_reason || null : null,
        });
      }

      const leadNumber = looksLikeLeadNumber(r.lead_number)
        ? String(r.lead_number).trim()
        : existing?.lead_number || `L-${Date.now().toString().slice(-8)}${String(100 + (i % 90))}`;

      const payload: Record<string, unknown> = {
        lead_type: fieldText(imported, 'Lead Type') || existing?.lead_type || 'NORMAL',
        lead_source: leadSource || fieldText(imported, 'Source') || existing?.lead_source || 'Other',
        created_from: existing?.created_from || fieldText(imported, 'Created From') || 'IMPORT',
        ...(pipeline ? { status: pipeline } : {}),
        customer_name: r.name || existing?.customer_name || `Customer_${r.phone_no.slice(-4)}`,
        customer_phone: r.phone_no,
        customer_email: fieldText(imported, 'Email') || existing?.customer_email || null,
        customer_alternate_phone: r.alternate_phone || existing?.customer_alternate_phone || null,
        customer_address: r.address || fieldText(imported, 'Address') || existing?.customer_address || null,
        address: r.address || fieldText(imported, 'Address') || existing?.address || null,
        city: fieldText(imported, 'City') || existing?.city || null,
        pincode: fieldText(imported, 'Pincode') || existing?.pincode || null,
        vehicle_number: r.car_number || fieldText(imported, 'Vehicle') || existing?.vehicle_number || 'NA',
        vehicle_make: r.make || fieldText(imported, 'Make') || existing?.vehicle_make || null,
        vehicle_model: r.model || fieldText(imported, 'Model') || existing?.vehicle_model || null,
        vehicle_variant: fieldText(imported, 'Variant') || existing?.vehicle_variant || null,
        vehicle_year: fieldText(imported, 'Year') || existing?.vehicle_year || null,
        vehicle_fuel_type: fieldText(imported, 'Fuel Type') || existing?.vehicle_fuel_type || null,
        service_type:
          r.plan || fieldText(imported, 'Service') || fieldText(imported, 'Service Type') || existing?.service_type || 'Car Service',
        description: r.remark || fieldText(imported, 'Notes') || existing?.description || null,
        problem_description:
          fieldText(imported, 'Problem') || existing?.problem_description || r.remark || null,
        pickup_required: pickupRequired || existing?.pickup_required || false,
        pickup_address: fieldText(imported, 'PickupAddress') || existing?.pickup_address || null,
        lead_priority: fieldText(imported, 'Priority') || existing?.lead_priority || 'NORMAL',
        workshop_id: workshopId || existing?.workshop_id || null,
        assigned_telecaller_id: assignee?.id || existing?.assigned_telecaller_id || null,
        assigned_at: assignee?.id ? updatedAt : existing?.assigned_at || null,
        follow_up_required: Boolean(r.next_followup_at) || crmStatus === 'CALLBACK',
        next_follow_up_at: r.next_followup_at || existing?.next_follow_up_at || null,
        coupon_code: fieldText(imported, 'Coupon') || existing?.coupon_code || null,
        discount_amount: fieldNumber(imported, 'Discount') ?? existing?.discount_amount ?? null,
        estimated_amount:
          fieldNumber(imported, 'Estimated Amt') ?? fieldNumber(imported, 'Amount') ?? existing?.estimated_amount ?? null,
        actual_amount: fieldNumber(imported, 'Actual Amt') ?? existing?.actual_amount ?? null,
        payment_mode: fieldText(imported, 'Payment Mode') || existing?.payment_mode || null,
        payment_status: fieldText(imported, 'Payment Status') || existing?.payment_status || null,
        coupon_meta: couponMeta,
        meta: {
          ...prevLeadMeta,
          telecrm_csv: true,
          telecrm_lead_id: r.telecrm_lead_id || prevLeadMeta.telecrm_lead_id || null,
          package_rate_access: r.package_rate_access || prevLeadMeta.package_rate_access || null,
          package: r.package || prevLeadMeta.package || null,
          workshop: r.workshop || prevLeadMeta.workshop || null,
          plan: r.plan || prevLeadMeta.plan || null,
          pickup_visit: r.pickup_visit || prevLeadMeta.pickup_visit || null,
          lead_tags: tags.length ? tags : prevLeadMeta.lead_tags || [],
          import_fields: { ...prevImport, ...imported },
          assignee_email: r.assignee_email || prevLeadMeta.assignee_email || null,
          dialer_id: r.dialer_id || fieldText(imported, 'DailerID') || prevLeadMeta.dialer_id || null,
          recording_url: fieldText(imported, 'Recording URL') || prevLeadMeta.recording_url || null,
          interested_date: fieldText(imported, 'InterestedDate') || prevLeadMeta.interested_date || null,
          loan_amount: fieldText(imported, 'LoanAmount') || prevLeadMeta.loan_amount || null,
          membership_amount: fieldText(imported, 'Membership Amount') || prevLeadMeta.membership_amount || null,
          assignee_manager_name: fieldText(imported, 'Assignee Manager name') || prevLeadMeta.assignee_manager_name || null,
          assignee_manager_email: fieldText(imported, 'Assignee Manager emailid') || prevLeadMeta.assignee_manager_email || null,
          reg_date: fieldText(imported, 'REGDATE') || prevLeadMeta.reg_date || null,
          short_address: fieldText(imported, 'shortAddress') || prevLeadMeta.short_address || null,
        },
        updated_at: updatedAt,
      };

      if (!existing) {
        payload.lead_number = leadNumber;
        payload.created_at = createdAt;
      }

      const tryWrite = async (body: Record<string, unknown>, id?: string) => {
        if (id) {
          return writer.from('service_leads').update(body).eq('id', id).select('id, lead_number').maybeSingle();
        }
        return writer.from('service_leads').insert([body]).select('id, lead_number').maybeSingle();
      };

      let { data: saved, error: writeErr } = await tryWrite(payload, existing?.id);
      if (writeErr) {
        const slim = { ...payload };
        delete slim.meta;
        delete slim.coupon_meta;
        delete slim.customer_alternate_phone;
        delete slim.follow_up_required;
        delete slim.next_follow_up_at;
        delete slim.assigned_at;
        delete slim.pickup_required;
        delete slim.telecaller_remarks;
        delete slim.utm_source;
        delete slim.utm_medium;
        delete slim.utm_campaign;
        ({ data: saved, error: writeErr } = await tryWrite(slim, existing?.id));
      }

      if (writeErr || !saved?.id) {
        errors.push(`${r.name || r.phone_no}: ${writeErr?.message || 'service_leads write failed'}`);
        continue;
      }

      if (existing?.id) updated += 1;
      else inserted += 1;
      if ((i + 1) % 20 === 0 || i + 1 === valid.length) {
        onProgress?.({ done: i + 1, total: valid.length, inserted, updated });
      }

      if (tags.length && supabaseAdmin) {
        try {
          const tagIds = await ensureTagIdsByNames(tags);
          if (tagIds.length) await addLeadTags(String(saved.id), tagIds);
        } catch (tagErr: any) {
          errors.push(`${r.phone_no} tags: ${tagErr?.message || 'tag apply failed'}`);
        }
      }

      if (r.next_followup_at && r.next_followup_at !== existing?.next_follow_up_at) {
        const { error: fuErr } = await writer.from('telecaller_follow_ups').insert([
          {
            lead_id: saved.id,
            telecaller_id: assignee?.id || existing?.assigned_telecaller_id || null,
            follow_up_type: 'CALLBACK',
            scheduled_time: r.next_followup_at,
            priority: 'NORMAL',
            reason: r.user_note || r.remark || 'TeleCRM next follow-up',
            status: 'PENDING',
            reminder_sent: false,
          },
        ]);
        if (fuErr) errors.push(`${r.phone_no} reminder: ${fuErr.message}`);
        else reminders += 1;
      }
    }

    if (inserted + updated === 0) {
      return {
        status: 400,
        body: {
          error: errors[0] || 'Failed to create Bookings leads',
          errors,
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        inserted,
        updated,
        reminders,
        skipped: mapped.length - valid.length,
        total: mapped.length,
        created_assignees: createdAssignees.length ? createdAssignees : undefined,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (e: any) {
    return { status: 500, body: { error: 'Internal server error', details: e?.message } };
  }
}

function queueSnapshot() {
  const job = readEnquiryUploadJob();
  return {
    id: job?.id || null,
    status: job?.status || 'idle',
    total: job?.total || 0,
    done: job?.done || 0,
    inserted: job?.inserted || 0,
    updated: job?.updated || 0,
    error: job?.error || '',
    received: job?.received || 0,
  };
}

export async function GET() {
  return NextResponse.json({ job: queueSnapshot() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (body?.queue) {
    const current = readEnquiryUploadJob();
    if (current?.status === 'running') {
      return NextResponse.json({ queued: true, already: true, job: queueSnapshot() });
    }
    const incoming = Array.isArray(body.rows) ? body.rows : [];
    const prevRows = current?.status === 'collecting' ? current.rows : [];
    const rows = body.reset ? incoming : [...prevRows, ...incoming];
    const job = {
      id: current?.status === 'collecting' && !body.reset ? current.id : crypto.randomUUID(),
      status: body.final ? 'running' : 'collecting',
      total: rows.length,
      done: 0,
      inserted: 0,
      updated: 0,
      received: rows.length,
      error: '',
      rows,
      overwrite: body.overwrite === true,
    };
    writeEnquiryUploadJob(job);
    if (body.final) {
      const snapshotRows = rows;
      const overwrite = job.overwrite;
      void runEnquiryUpload(snapshotRows, overwrite, (patch) => {
        patchEnquiryUploadJob(patch);
      }).then((result) => {
        const payload = result.body as { inserted?: number; updated?: number; error?: string };
        patchEnquiryUploadJob({
          status: result.status === 200 ? 'done' : 'error',
          done: snapshotRows.length,
          inserted: Number(payload?.inserted || 0),
          updated: Number(payload?.updated || 0),
          error: result.status === 200 ? '' : String(payload?.error || 'Upload failed'),
          rows: [],
        });
      });
    }
    return NextResponse.json({ queued: true, job: queueSnapshot() });
  }

  const result = await runEnquiryUpload(body.rows, body?.overwrite === true);
  return NextResponse.json(result.body, { status: result.status });
}
