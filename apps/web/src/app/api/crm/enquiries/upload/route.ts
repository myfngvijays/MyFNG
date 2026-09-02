import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { addLeadTags, ensureTagIdsByNames } from '@/lib/telecaller/crmLeadTagsApply';
import {
  enrichEnquiryMakes,
  enrichEnquiryTags,
  isValidEnquiryPhone,
  mapEnquiryCsvRows,
  normalizePhoneDigits,
  parseLeadTagTokens,
  primaryLeadSourceFromTags,
} from '@/lib/crm/normalizeEnquiryCsv';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function remarkField(remark: string, label: string): string {
  const m = String(remark || '').match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
  return m ? m[1].trim() : '';
}

function toTimestamptz(val: any): string | null {
  const s = String(val || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows: Record<string, any>[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const parseDate = (val: any): string | null => {
      if (!val) return null;
      const s = val.toString().trim();
      if (!s || /^[_-]+$/.test(s)) return null;
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      return null;
    };

    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const writer = supabaseAdmin || supabase;

    const asStrings = rows.map((r) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(r || {})) out[k] = v == null ? '' : String(v);
      return out;
    });

    const [{ data: tagRows }] = await Promise.all([
      writer.from('crm_lead_tags').select('name'),
    ]);
    const catalogTags = (tagRows || []).map((t: any) => String(t.name || '').trim()).filter(Boolean);

    let mapped = mapEnquiryCsvRows(asStrings, catalogTags);
    mapped = await enrichEnquiryMakes(mapped, async () => {
      const { data } = await writer.from('car_models').select('make, model_name').eq('is_active', true);
      return data || [];
    });
    mapped = await enrichEnquiryTags(mapped, async () => catalogTags);

    const cleaned = mapped.map((r) => {
      const phone = normalizePhoneDigits(r.phone_no || '');
      const row: Record<string, any> = {
        phone_no: phone,
        name: r.name || null,
        address: r.address || null,
        regdate: parseDate(r.regdate),
        car_number: r.car_number || null,
        make: r.make || null,
        model: r.model || null,
        lead_tags: r.lead_tags || null,
        package_rate_access: r.package_rate_access || null,
        disposition: r.disposition || null,
        remark: r.remark || null,
        dialer_id: r.dialer_id || null,
      };
      const createdAt = toTimestamptz(r.created_at);
      const updatedAt = toTimestamptz(r.updated_at);
      if (createdAt) row.created_at = createdAt;
      if (updatedAt) row.updated_at = updatedAt;
      return row;
    });

    const invalidPhones = cleaned
      .filter((r) => !isValidEnquiryPhone(r.phone_no))
      .slice(0, 8)
      .map((r) => `${r.name || 'row'}: ${r.phone_no || '(empty)'} (${String(r.phone_no || '').length} digits)`);

    const valid = cleaned.filter((r) => isValidEnquiryPhone(r.phone_no));

    if (valid.length === 0) {
      return NextResponse.json({
        error: `No valid 10-digit mobile numbers. ${invalidPhones.join('; ')}. Use 10 digits starting 6-9, or 91 + 10 digits.`,
        invalid: invalidPhones,
      }, { status: 400 });
    }

    const errors: string[] = [];
    let inserted = 0;

    const stripNewCols = (batch: Record<string, any>[]) =>
      batch.map(({ lead_tags, package_rate_access, ...rest }) => {
        const extra = [
          rest.remark,
          lead_tags ? `Tags: ${lead_tags}` : '',
          package_rate_access ? `Rate access: ${package_rate_access}` : '',
        ].filter(Boolean);
        return { ...rest, remark: extra.join(' | ') || null };
      });

    for (let i = 0; i < valid.length; i += 500) {
      const batch = valid.slice(i, i + 500);
      let { error } = await supabase.from('crm_enquiries').insert(batch);
      if (error && /lead_tags|package_rate_access|column/i.test(error.message || '')) {
        const retry = await supabase.from('crm_enquiries').insert(stripNewCols(batch));
        error = retry.error;
      }
      if (error) errors.push(`crm_enquiries: ${error.message}`);
    }

    if (!writer) {
      return NextResponse.json({
        success: inserted > 0,
        inserted,
        skipped: rows.length - valid.length,
        total: rows.length,
        errors: [...errors, adminError || 'Could not write Bookings leads'].filter(Boolean),
      });
    }

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      const nowIso = new Date().toISOString();
      const createdAt = r.created_at || nowIso;
      const updatedAt = r.updated_at || nowIso;
      const tags = parseLeadTagTokens(r.lead_tags || '');
      const leadSource = primaryLeadSourceFromTags(r.lead_tags || '');
      const pickupHint = remarkField(r.remark || '', 'Pickup/Visit');
      const plan = remarkField(r.remark || '', 'Plan');
      const workshop = remarkField(r.remark || '', 'Workshop');
      const leadNumber = `L-${Date.now().toString().slice(-8)}${String(100 + (i % 90))}`;

      const basePayload: Record<string, unknown> = {
        lead_number: leadNumber,
        lead_type: 'NORMAL',
        lead_source: leadSource,
        created_from: 'IMPORT',
        status: 'NEW',
        customer_name: r.name || `Customer_${String(r.phone_no).slice(-4)}`,
        customer_phone: r.phone_no,
        customer_address: r.address || null,
        address: r.address || null,
        vehicle_number: r.car_number || 'NA',
        vehicle_make: r.make || null,
        vehicle_model: r.model || null,
        service_type: plan || 'Car Service',
        description: r.remark || null,
        problem_description: r.disposition || r.remark || null,
        pickup_required: /pickup/i.test(pickupHint),
        lead_priority: 'NORMAL',
        meta: {
          telecrm_csv: true,
          package_rate_access: r.package_rate_access || null,
          workshop: workshop || null,
          plan: plan || null,
          lead_tags: tags,
        },
        created_at: createdAt,
        updated_at: updatedAt,
      };

      const tryInsert = (payload: Record<string, unknown>) =>
        writer.from('service_leads').insert([payload]).select('id, lead_number').maybeSingle();

      let { data: insertedLead, error: insertErr } = await tryInsert(basePayload);
      if (insertErr) {
        const slim = { ...basePayload };
        delete slim.meta;
        delete slim.problem_description;
        delete slim.pickup_required;
        delete slim.lead_priority;
        delete slim.customer_address;
        ({ data: insertedLead, error: insertErr } = await tryInsert(slim));
      }
      if (insertErr && /created_from/i.test(insertErr.message || '')) {
        ({ data: insertedLead, error: insertErr } = await tryInsert({ ...basePayload, created_from: 'API' }));
      }

      if (insertErr || !insertedLead?.id) {
        errors.push(`${r.name || r.phone_no}: ${insertErr?.message || 'service_leads insert failed'}`);
        continue;
      }

      inserted += 1;
      if (tags.length && supabaseAdmin) {
        try {
          const tagIds = await ensureTagIdsByNames(tags);
          if (tagIds.length) await addLeadTags(String(insertedLead.id), tagIds);
        } catch (tagErr: any) {
          errors.push(`${r.phone_no} tags: ${tagErr?.message || 'tag apply failed'}`);
        }
      }
    }

    if (inserted === 0) {
      return NextResponse.json({
        error: errors[0] || 'Failed to create Bookings leads',
        errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped: rows.length - valid.length,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
