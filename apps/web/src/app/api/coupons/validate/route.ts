import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { validateCouponForCheckout } from '@/lib/coupon-service';

export const dynamic = 'force-dynamic';

type ValidatePayload = {
  code?: string;
  lead_context?: {
    subtotal?: number;
    service_type_ids?: string[];
    subservice_ids?: string[];
    custom_labels?: string[];
    service_items?: Array<{
      service_type_id?: string | null;
      subservice_id?: string | null;
      label?: string | null;
      price?: number | null;
    }>;
    customer_phone?: string | null;
    customer_id?: string | null;
    channel?: string | null;
    city_id?: string | null;
    workshop_id?: string | null;
  };
};

function parseBodyText(text: string): ValidatePayload | null {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as ValidatePayload;
  } catch {
    return { code: trimmed };
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestClone = request.clone();
    const body = (await request
      .json()
      .catch(async () => parseBodyText(await requestClone.text().catch(() => '')) || {})) as ValidatePayload;

    const codeRaw = String(body?.code || request.nextUrl.searchParams.get('code') || '').trim();
    if (!codeRaw) {
      return NextResponse.json({ valid: false, error: 'Coupon code is required.' }, { status: 200 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ valid: false, error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const leadContext = {
      ...(body.lead_context || {}),
      channel: body.lead_context?.channel || 'WEB',
      custom_labels: body.lead_context?.custom_labels || [],
    };

    const reserveOnly = Boolean((body.lead_context as any)?.reserve_only);
    const result = await validateCouponForCheckout(supabaseAdmin, codeRaw, leadContext, {
      membershipOnly: leadContext.channel === 'MEMBERSHIP',
      serviceBooking: leadContext.channel !== 'MEMBERSHIP',
      reserveOnly,
    });

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error,
          discount_amount: 0,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: result.coupon.id,
        code: result.coupon.code,
        coupon_kind: result.coupon.coupon_kind,
        discount_mode: result.coupon.discount_mode,
        discount_value: result.coupon.discount_value,
        min_order_value: result.coupon.min_order_value,
        target_service_type_id: result.coupon.target_service_type_id,
        target_subservice_id: result.coupon.target_subservice_id,
        target_custom_label: result.coupon.target_custom_label,
        description: result.coupon.description,
        campaign_name: result.coupon.campaign_name,
      },
      discount_amount: result.discountAmount,
      coupon_meta: result.couponMeta,
    });
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
