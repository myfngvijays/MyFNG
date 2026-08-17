import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { inferPricingCategoriesFromLead } from '@/lib/telecaller/sendLeadPricingWhatsApp';
import { createAndSendPricingShare } from '@/lib/telecaller/pricingShareLinks';
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
 * Create time-limited pricing page (myfng.in/p/{slug}) and WhatsApp the link.
 * Works for Periodic + all other categories. Default link TTL: 3 hours.
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
    if (roleCode !== 'TELECALLER' && roleCode !== 'LEAD_MANAGER' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const result = await createAndSendPricingShare({
      phone: String(row.customer_phone || ''),
      customerName: row.customer_name,
      carModel,
      pincode,
      city: row.city || meta.city || null,
      categories,
      serviceTypeIds: serviceTypeIds.length ? serviceTypeIds : null,
      leadId: row.id,
      leadNumber: row.lead_number,
      createdBy: userProfile?.id || user.id,
      ttlHours: Number(body?.ttlHours) > 0 ? Number(body.ttlHours) : 3,
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

      // Link may still exist — return URL so telecaller can copy
      const message =
        result.error === 'pincode_required'
          ? 'Fill 6-digit pincode before sending pricing.'
          : result.error === 'car_model_required'
            ? 'Fill car model before sending pricing.'
            : result.error === 'services_required'
              ? 'Fill car model and pincode, then send.'
              : result.url
                ? `WhatsApp send failed, but pricing page is ready: ${result.url}`
                : result.details?.filter(Boolean).join(' ') ||
                  'Could not send pricing link on WhatsApp.';

      return NextResponse.json(
        {
          success: Boolean(result.url),
          error: message,
          code: result.error,
          message,
          shareUrl: result.url || null,
          expiresAt: result.expiresAt || null,
          result,
        },
        { status: result.url ? 200 : status },
      );
    }

    try {
      const prevMeta =
        row.coupon_meta && typeof row.coupon_meta === 'object' ? { ...row.coupon_meta } : {};
      prevMeta.pricing_whatsapp_sent_at = new Date().toISOString();
      prevMeta.pricing_whatsapp_sent_by = user.id;
      prevMeta.pricing_share = {
        url: result.url,
        slug: result.slug,
        expires_at: result.expiresAt,
        channel: result.channel,
        categories,
      };
      await db
        .from('service_leads')
        .update({ coupon_meta: prevMeta, updated_at: new Date().toISOString() })
        .eq('id', leadId);
    } catch {
      /* optional */
    }

    return NextResponse.json({
      success: true,
      message: `Pricing link sent (valid ~6 hours).\n${result.url}`,
      shareUrl: result.url,
      expiresAt: result.expiresAt,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
