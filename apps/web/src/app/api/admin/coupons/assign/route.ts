import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { logCouponAudit } from '@/lib/coupon-rules';
import { googleSheetToCsvExportUrl } from '@/lib/google-sheet-url';
import { extractPhonesFromTabularText, parsePhoneList } from '@/lib/phone-list-parser';

export { parsePhoneList };

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

async function resolvePhonesFromBody(body: Record<string, unknown>): Promise<string[]> {
  const googleSheetUrl = String(body?.google_sheet_url || body?.sheet_url || '').trim();
  if (googleSheetUrl) {
    const exportUrl = googleSheetToCsvExportUrl(googleSheetUrl);
    if (!exportUrl) throw new Error('Invalid Google Sheet URL.');
    const res = await fetch(exportUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'MyFNG-Coupon-Assign/1.0' },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(
        'Could not fetch Google Sheet. Share it as "Anyone with the link → Viewer" or publish to web.',
      );
    }
    const text = await res.text();
    const phones = extractPhonesFromTabularText(text);
    if (!phones.length) throw new Error('No valid mobile numbers found in the Google Sheet.');
    return phones;
  }

  const bulkPhones = parsePhoneList(body?.phones ?? body?.phones_text ?? '');
  const singlePhone = String(body?.phone || '').replace(/\D/g, '').slice(-10);
  return bulkPhones.length > 0 ? bulkPhones : singlePhone.length === 10 ? [singlePhone] : [];
}

async function resolveCustomerIdsByPhones(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>['supabaseAdmin']>,
  phones: string[],
) {
  const phoneToCustomerId = new Map<string, string>();
  await Promise.all(
    phones.map(async (phone) => {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id, phone')
        .ilike('phone', `%${phone}`)
        .maybeSingle();
      if (customer?.id) phoneToCustomerId.set(phone, String(customer.id));
    }),
  );
  return phoneToCustomerId;
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const couponId = String(body?.coupon_id || '').trim();
    if (!couponId) return NextResponse.json({ error: 'coupon_id is required' }, { status: 400 });

    const phones = await resolvePhonesFromBody(body);
    if (phones.length === 0) {
      return NextResponse.json(
        { error: 'Provide phone, phones list, phones_text, or google_sheet_url' },
        { status: 400 },
      );
    }

    let customerId = String(body?.customer_id || '').trim();
    if (!(phones.length === 1 && customerId)) customerId = '';

    const phoneToCustomerId = customerId
      ? new Map([[phones[0], customerId]])
      : await resolveCustomerIdsByPhones(supabaseAdmin, phones);

    const foundPhones = phones.filter((phone) => phoneToCustomerId.has(phone));
    const pendingPhones = phones.filter((phone) => !phoneToCustomerId.has(phone));

    if (foundPhones.length === 0 && pendingPhones.length === 0) {
      return NextResponse.json(
        { error: 'No valid phone numbers provided.', assigned_count: 0 },
        { status: 400 },
      );
    }

    const registeredRows = foundPhones.map((phone) => ({
      customer_id: phoneToCustomerId.get(phone)!,
      coupon_id: couponId,
      assigned_by: gate.userId,
      notes: body?.notes || null,
      expires_at: body?.expires_at || null,
      redeemed_at: null,
    }));

    const pendingRows = pendingPhones.map((phone) => ({
      pending_phone: phone,
      coupon_id: couponId,
      assigned_by: gate.userId,
      notes: body?.notes || null,
      expires_at: body?.expires_at || null,
      redeemed_at: null,
    }));

    let assignedData: any[] = [];

    if (registeredRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('customer_coupon_assignments')
        .upsert(registeredRows, { onConflict: 'customer_id,coupon_id' })
        .select('id, customer_id, coupon_id, notes, created_at, coupon:coupons(code)');
      if (error) throw error;
      assignedData = data || [];
    }

    let pendingCount = 0;
    if (pendingRows.length > 0) {
      for (const row of pendingRows) {
        const { error: pendErr } = await supabaseAdmin
          .from('customer_coupon_assignments')
          .upsert(row, { onConflict: 'pending_phone,coupon_id', ignoreDuplicates: true });
        if (!pendErr) pendingCount++;
      }
    }

    const totalAssigned = foundPhones.length + pendingCount;

    const isBulk = phones.length > 1;
    await logCouponAudit(supabaseAdmin, {
      coupon_id: couponId,
      action: isBulk ? 'ASSIGN_BULK' : 'ASSIGN',
      actor_user_id: gate.userId,
      details: {
        assigned_count: totalAssigned,
        registered_count: foundPhones.length,
        pending_count: pendingCount,
        pending_phones: pendingPhones,
        phones: foundPhones,
        source: body?.google_sheet_url ? 'google_sheet' : body?.phones_text ? 'bulk_text' : 'single',
        notes: body?.notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      assigned_count: totalAssigned,
      registered_count: foundPhones.length,
      pending_count: pendingCount,
      pending_phones: pendingPhones,
      assignments: assignedData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
