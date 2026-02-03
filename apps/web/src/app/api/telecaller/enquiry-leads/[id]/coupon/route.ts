import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    const params = await paramsPromise;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leadId = String(params?.id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const rawCode = String(body?.code || '').trim();

    const { data: lead, error: leadErr } = await supabase
      .from('enquiry_hub')
      .select('*')
      .eq('kind', 'LEAD')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (String((lead as any)?.assigned_telecaller_id || '') !== String(userProfile?.id || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const serviceLeadId = (lead as any)?.meta?.service_lead_id || null;
    let serviceLead: any = null;
    if (serviceLeadId) {
      const { data } = await supabaseAdmin
        .from('service_leads')
        .select('id, service_type_ids, estimated_amount, customer_phone')
        .eq('id', serviceLeadId)
        .maybeSingle();
      serviceLead = data || null;
    }

    const nowIso = new Date().toISOString();

    if (!rawCode) {
      // Clear coupon
      const meta = { ...(lead as any)?.meta, coupon: null };
      await supabaseAdmin.from('enquiry_hub').update({ meta, updated_at: nowIso }).eq('id', leadId);
      if (serviceLeadId) {
        await supabaseAdmin
          .from('service_leads')
          .update({ coupon_code: null, discount_amount: 0, coupon_meta: null })
          .eq('id', serviceLeadId);
      }
      return NextResponse.json({ success: true, coupon: null });
    }

    const code = normalizeCode(rawCode);
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .ilike('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (couponError || !coupon) {
      return NextResponse.json({ error: 'Invalid or inactive coupon.' }, { status: 400 });
    }

    if (coupon.start_at && String(coupon.start_at) > nowIso) {
      return NextResponse.json({ error: 'Coupon is not active yet.' }, { status: 400 });
    }
    if (coupon.end_at && String(coupon.end_at) < nowIso) {
      return NextResponse.json({ error: 'Coupon has expired.' }, { status: 400 });
    }

    const subtotal = Number(serviceLead?.estimated_amount || 0);
    if (coupon.min_order_value && subtotal < Number(coupon.min_order_value || 0)) {
      return NextResponse.json(
        { error: `Minimum order value is ₹${coupon.min_order_value}.` },
        { status: 400 }
      );
    }

    let discountAmount = 0;
    let freeServiceMeta: any = null;

    if (coupon.coupon_kind === 'TOTAL_DISCOUNT') {
      if (!coupon.discount_mode || !coupon.discount_value || subtotal <= 0) {
        return NextResponse.json({ error: 'Invalid discount configuration.' }, { status: 400 });
      }
      if (coupon.discount_mode === 'AMOUNT') {
        discountAmount = Math.min(Number(coupon.discount_value || 0), subtotal);
      } else if (coupon.discount_mode === 'PERCENT') {
        discountAmount = (subtotal * Number(coupon.discount_value || 0)) / 100;
      }
    } else if (coupon.coupon_kind === 'FREE_SERVICE') {
      const serviceTypeIds = Array.isArray(serviceLead?.service_type_ids) ? serviceLead.service_type_ids : [];
      const matchesService =
        (coupon.target_service_type_id && serviceTypeIds.includes(coupon.target_service_type_id)) ||
        Boolean(coupon.target_custom_label);
      if (!matchesService) {
        return NextResponse.json(
          { error: 'Coupon is not applicable to selected services.' },
          { status: 400 }
        );
      }
      freeServiceMeta = {
        target_service_type_id: coupon.target_service_type_id || null,
        target_subservice_id: coupon.target_subservice_id || null,
        target_custom_label: coupon.target_custom_label || null,
        matched_label: coupon.target_custom_label || null,
        original_price: 0,
      };
    }

    const couponMeta = {
      coupon_id: coupon.id,
      code: coupon.code,
      coupon_kind: coupon.coupon_kind,
      discount_mode: coupon.discount_mode,
      discount_value: coupon.discount_value,
      min_order_value: coupon.min_order_value,
      discount_amount: Number(discountAmount || 0),
      computed_on_subtotal: subtotal,
      free_service: freeServiceMeta,
      validated_at: nowIso,
    };

    const meta = { ...(lead as any)?.meta, coupon: couponMeta };
    await supabaseAdmin.from('enquiry_hub').update({ meta, updated_at: nowIso }).eq('id', leadId);

    if (serviceLeadId) {
      await supabaseAdmin
        .from('service_leads')
        .update({ coupon_code: coupon.code, discount_amount: discountAmount, coupon_meta: couponMeta })
        .eq('id', serviceLeadId);
    }

    await supabaseAdmin.from('coupon_redemptions').insert({
      coupon_id: coupon.id,
      service_lead_id: serviceLeadId,
      applied_by_role: 'TELECALLER',
      applied_by_user_id: userProfile?.id || null,
      discount_amount_applied: discountAmount,
      meta: {
        customer_phone: serviceLead?.customer_phone || null,
      },
    });

    return NextResponse.json({ success: true, coupon: couponMeta });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
