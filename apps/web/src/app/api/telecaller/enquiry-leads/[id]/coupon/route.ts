import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { validateCouponForCheckout, redeemCouponAtomic } from '@/lib/coupon-service';

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
    const nowIso = new Date().toISOString();

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
        .select('id, service_type_ids, estimated_amount, customer_phone, customer_name, lead_number, city_id')
        .eq('id', serviceLeadId)
        .maybeSingle();
      serviceLead = data || null;
    }

    if (!rawCode) {
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

    const subtotal = Number(serviceLead?.estimated_amount || body?.subtotal || 0);
    const couponResult = await validateCouponForCheckout(
      supabaseAdmin,
      rawCode,
      {
        subtotal,
        customer_phone: serviceLead?.customer_phone || body?.customer_phone || null,
        service_type_ids: Array.isArray(serviceLead?.service_type_ids) ? serviceLead.service_type_ids : [],
        city_id: serviceLead?.city_id || body?.city_id || null,
        channel: 'TELECALLER',
      },
      { serviceBooking: true },
    );

    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 });
    }

    const couponMeta = couponResult.couponMeta;
    const discountAmount = couponResult.discountAmount;
    const meta = { ...(lead as any)?.meta, coupon: couponMeta };
    await supabaseAdmin.from('enquiry_hub').update({ meta, updated_at: nowIso }).eq('id', leadId);

    if (serviceLeadId) {
      await supabaseAdmin
        .from('service_leads')
        .update({
          coupon_code: couponMeta.code,
          discount_amount: discountAmount,
          coupon_meta: couponMeta,
        })
        .eq('id', serviceLeadId);
    }

    const redeemed = await redeemCouponAtomic(supabaseAdmin, {
      couponId: String(couponMeta.coupon_id),
      customerPhone:
        serviceLead?.customer_phone ||
        (lead as any)?.customer_phone ||
        body?.customer_phone ||
        null,
      discountAmount,
      appliedByRole: 'TELECALLER',
      appliedByUserId: userProfile?.id || null,
      serviceLeadId,
      idempotencyKey: serviceLeadId ? `telecaller-enquiry:${leadId}:${couponMeta.code}` : null,
      meta: {
        enquiry_lead_id: leadId,
        channel: 'TELECALLER',
        customer_name: serviceLead?.customer_name || (lead as any)?.customer_name || null,
        lead_number: serviceLead?.lead_number || (lead as any)?.lead_number || null,
      },
    });

    if (!redeemed.success) {
      return NextResponse.json({ error: redeemed.error || 'Could not redeem coupon' }, { status: 400 });
    }

    return NextResponse.json({ success: true, coupon: couponMeta });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
