import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { generateBulkCodes, logCouponAudit } from '@/lib/coupon-rules';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const count = Math.min(Math.max(Number(body?.count || 0), 1), 5000);
    const prefix = String(body?.prefix || body?.code_prefix || 'MYFNG').trim().toUpperCase();
    const randomLength = Math.min(Math.max(Number(body?.random_length || 6), 4), 12);
    const campaignName = String(body?.campaign_name || `Bulk ${prefix}`).trim();

    const template = {
      coupon_kind: String(body?.coupon_kind || 'TOTAL_DISCOUNT').trim(),
      discount_mode: body?.discount_mode ? String(body.discount_mode).trim() : null,
      discount_value: body?.discount_value != null ? Number(body.discount_value) : null,
      min_order_value: body?.min_order_value != null ? Number(body.min_order_value) : null,
      start_at: body?.start_at || null,
      end_at: body?.end_at || null,
      usage_limit_total: body?.usage_limit_total != null ? Number(body.usage_limit_total) : 1,
      usage_limit_per_customer: body?.usage_limit_per_customer != null ? Number(body.usage_limit_per_customer) : 1,
      description: body?.description || null,
      applicable_city_ids: body?.applicable_city_ids || null,
      applicable_workshop_ids: body?.applicable_workshop_ids || null,
      applicable_service_type_ids: body?.applicable_service_type_ids || null,
      applicable_channels: body?.applicable_channels || ['ALL'],
      max_discount_amount: body?.max_discount_amount != null ? Number(body.max_discount_amount) : null,
      first_order_only: body?.first_order_only ?? false,
      is_public: body?.is_public ?? false,
      is_active: body?.is_active ?? true,
    };

    const codes = generateBulkCodes(prefix, count, randomLength);
    if (codes.length === 0) {
      return NextResponse.json({ error: 'Could not generate coupon codes' }, { status: 400 });
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('coupon_batches')
      .insert({
        campaign_name: campaignName,
        code_prefix: prefix,
        code_count: codes.length,
        ...template,
        created_by: gate.userId,
      })
      .select()
      .single();

    if (batchError || !batch) throw batchError || new Error('Failed to create batch');

    const rows = codes.map((code) => ({
      code,
      ...template,
      campaign_name: campaignName,
      batch_id: batch.id,
      created_by: gate.userId,
    }));

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('coupons')
      .insert(rows)
      .select('id, code');

    if (insertError) throw insertError;

    await logCouponAudit(supabaseAdmin, {
      batch_id: batch.id,
      action: 'BULK_CREATE',
      actor_user_id: gate.userId,
      details: { campaign_name: campaignName, prefix, count: inserted?.length || 0 },
    });

    return NextResponse.json({
      success: true,
      batch,
      created_count: inserted?.length || 0,
      codes: (inserted || []).map((row: any) => row.code),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
