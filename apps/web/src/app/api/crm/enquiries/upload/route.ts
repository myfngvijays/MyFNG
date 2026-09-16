import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { addLeadTags, ensureTagIdsByNames } from '@/lib/telecaller/crmLeadTagsApply';
import { appendLeadProfileHistory, findLatestServiceLeadByPhone } from '@/lib/service-lead-reopen';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows: Record<string, any>[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
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
      return NextResponse.json({
        error: 'No valid 10-digit mobile numbers. Use 10 digits starting 6-9, or 91 + 10 digits.',
      }, { status: 400 });
    }

    if (!writer) {
      return NextResponse.json({
        error: adminError || 'Could not write Bookings leads',
      }, { status: 500 });
    }

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
      const crmStatus = r.crm_status || 'FRESH';
      const crmLabel =
        crmStatus === 'LOST' && r.lost_reason
          ? `Lost · ${r.lost_reason}`
          : r.crm_status_label || r.disposition || 'Fresh';
      const pipeline = r.crm_pipeline || (crmStatus === 'LOST' ? 'REJECTED' : 'NEW');
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
      const existing = await findLatestServiceLeadByPhone(writer, r.phone_no);
      const prevMeta =
        existing?.coupon_meta && typeof existing.coupon_meta === 'object' && !Array.isArray(existing.coupon_meta)
          ? { ...existing.coupon_meta }
          : {};
      const prevLeadMeta =
        existing?.meta && typeof existing.meta === 'object' && !Array.isArray(existing.meta)
          ? { ...existing.meta }
          : {};

      let couponMeta: Record<string, unknown> = {
        ...prevMeta,
        last_call_result: crmStatus,
        last_call_label: crmLabel,
        last_call_at: updatedAt,
        last_lost_reason: crmStatus === 'LOST' ? r.lost_reason || 'Other Reasons' : prevMeta.last_lost_reason || null,
        telecrm_csv: true,
        telecrm_status: r.disposition || null,
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
        lead_type: existing?.lead_type || 'NORMAL',
        lead_source: leadSource || existing?.lead_source || 'Other',
        created_from: existing?.created_from || 'IMPORT',
        status: pipeline,
        customer_name: r.name || existing?.customer_name || `Customer_${r.phone_no.slice(-4)}`,
        customer_phone: r.phone_no,
        customer_alternate_phone: r.alternate_phone || existing?.customer_alternate_phone || null,
        customer_address: r.address || existing?.customer_address || null,
        address: r.address || existing?.address || null,
        vehicle_number: r.car_number || existing?.vehicle_number || 'NA',
        vehicle_make: r.make || existing?.vehicle_make || null,
        vehicle_model: r.model || existing?.vehicle_model || null,
        service_type: r.plan || existing?.service_type || 'Car Service',
        description: r.remark || existing?.description || null,
        problem_description: r.disposition || existing?.problem_description || r.remark || null,
        pickup_required: pickupRequired,
        lead_priority: existing?.lead_priority || 'NORMAL',
        workshop_id: workshopId || existing?.workshop_id || null,
        assigned_telecaller_id: assignee?.id || existing?.assigned_telecaller_id || null,
        assigned_at: assignee?.id ? updatedAt : existing?.assigned_at || null,
        follow_up_required: Boolean(r.next_followup_at) || crmStatus === 'CALLBACK',
        next_follow_up_at: r.next_followup_at || existing?.next_follow_up_at || null,
        coupon_meta: couponMeta,
        telecaller_remarks: r.user_note || existing?.telecaller_remarks || null,
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
        ({ data: saved, error: writeErr } = await tryWrite(slim, existing?.id));
      }

      if (writeErr || !saved?.id) {
        errors.push(`${r.name || r.phone_no}: ${writeErr?.message || 'service_leads write failed'}`);
        continue;
      }

      if (existing?.id) updated += 1;
      else inserted += 1;

      if (tags.length && supabaseAdmin) {
        try {
          const tagIds = await ensureTagIdsByNames(tags);
          if (tagIds.length) await addLeadTags(String(saved.id), tagIds);
        } catch (tagErr: any) {
          errors.push(`${r.phone_no} tags: ${tagErr?.message || 'tag apply failed'}`);
        }
      }

      if (r.next_followup_at) {
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
      return NextResponse.json({
        error: errors[0] || 'Failed to create Bookings leads',
        errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      reminders,
      skipped: mapped.length - valid.length,
      total: mapped.length,
      created_assignees: createdAssignees.length ? createdAssignees : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
