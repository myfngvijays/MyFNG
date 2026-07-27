import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  inferPricingCategoriesFromLead,
  sendLeadPricingWhatsApp,
} from '@/lib/telecaller/sendLeadPricingWhatsApp';
import { parseServiceIdList } from '@/lib/telecaller/crmQuote';

async function loadLeadRow(db: any, leadId: string) {
  const selects = [
    `id, lead_number, customer_name, customer_phone, vehicle_make, vehicle_model, model_id, city, pincode, coupon_meta, service_type_ids, service_type`,
    `id, lead_number, customer_name, customer_phone, vehicle_model, city, pincode, service_type_ids`,
    `id, lead_number, customer_name, customer_phone, vehicle_model, city, pincode`,
  ];
  for (const columns of selects) {
    const { data, error } = await db.from('service_leads').select(columns).eq('id', leadId).maybeSingle();
    if (!error && data) return data;
  }
  return null;
}

/**
 * Send pricing for SELECTED service categories only (session text/list — no Meta template).
 * Requires pincode + car model + at least one selected service.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));

    const { data: accessible } = await supabase
      .from('service_leads')
      .select('id')
      .eq('id', leadId)
      .maybeSingle();
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;
    const row: any = (await loadLeadRow(db, leadId)) || (await loadLeadRow(supabase, leadId));
    if (!row?.id) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const meta = row.coupon_meta && typeof row.coupon_meta === 'object' ? row.coupon_meta : {};
    const pincode = String(body?.pincode || row.pincode || meta.pincode || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    const carModel = String(
      body?.carModel ||
        body?.vehicle_model ||
        [row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') ||
        row.vehicle_model ||
        '',
    ).trim();

    const serviceTypeIds = parseServiceIdList(
      body?.serviceTypeIds ?? body?.service_type_ids ?? row.service_type_ids,
    );

    // Categories: body → coupon_meta → booking_type/package → default Periodic (all 4 tiers)
    const bodyCategories = Array.isArray(body?.categories)
      ? body.categories.map((c: any) => String(c || '').trim()).filter(Boolean)
      : [];
    const metaCategories = Array.isArray(meta.pricing_categories)
      ? meta.pricing_categories.map((c: any) => String(c || '').trim()).filter(Boolean)
      : [];
    let categories = bodyCategories.length ? bodyCategories : metaCategories;
    if (!categories.length && !serviceTypeIds.length) {
      categories = inferPricingCategoriesFromLead({
        bookingType: meta.booking_type,
        packageLabel: meta.package_label,
        interestLabel: meta.interest_label,
        serviceType: row.service_type,
        defaultPeriodic: true,
      });
    }

    const result = await sendLeadPricingWhatsApp({
      phone: String(row.customer_phone || ''),
      pincode,
      carModel,
      customerName: row.customer_name,
      leadId: row.id,
      leadNumber: row.lead_number,
      // Specific plans win; empty ids + categories = all plans in category
      serviceTypeIds: serviceTypeIds.length ? serviceTypeIds : null,
      categories: categories.length ? categories : null,
    });

    if (!result.sent) {
      const status =
        result.error === 'pincode_required' ||
        result.error === 'car_model_required' ||
        result.error === 'services_required'
          ? 400
          : result.error === 'whatsapp_send_failed'
            ? 502
            : 422;
      const message =
        result.error === 'pincode_required'
          ? 'Fill 6-digit pincode before sending pricing.'
          : result.error === 'car_model_required'
            ? 'Fill car model before sending pricing.'
            : result.error === 'services_required'
              ? 'Select Periodic/AC (category) for all plans, or Add a specific plan (Basic/General/…) then send.'
              : result.error === 'no_pricing_for_selection'
                ? 'No prices found for the selected plan/category + this pincode/model.'
                : result.details?.filter(Boolean).join(' ') ||
                  'Could not send pricing on WhatsApp. Customer needs an open 24h WhatsApp chat.';
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: result.error,
          message,
          result,
        },
        { status },
      );
    }

    try {
      const prevMeta =
        row.coupon_meta && typeof row.coupon_meta === 'object' ? { ...row.coupon_meta } : {};
      prevMeta.pricing_whatsapp_sent_at = new Date().toISOString();
      prevMeta.pricing_whatsapp_sent_by = user.id;
      prevMeta.pricing_whatsapp_summary = {
        categories: result.categories,
        mode: result.mode,
        periodic: result.periodicCount,
        other_categories: result.otherCategoryCount,
        messages: result.messagesSent,
      };
      await db
        .from('service_leads')
        .update({ coupon_meta: prevMeta, updated_at: new Date().toISOString() })
        .eq('id', leadId);
    } catch {
      /* optional */
    }

    const catLabel = result.categories.length ? result.categories.join(', ') : 'selected services';
    return NextResponse.json({
      success: true,
      message: `Pricing sent for ${catLabel} (${result.messagesSent} WhatsApp message${result.messagesSent === 1 ? '' : 's'}).`,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
