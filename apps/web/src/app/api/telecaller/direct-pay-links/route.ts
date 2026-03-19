import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

async function resolveUserProfile(supabase: any, user: any) {
  const email = (user?.email || '').trim();
  const phone = (user?.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null as any };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null as any };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user?.id).maybeSingle()
    : { data: null as any };

  return byEmail || byPhone || byId;
}

function normalizeDirectPayRow(row: any) {
  const notes = row?.notes && typeof row.notes === 'object' ? row.notes : {};
  const linkRef = String((notes as any)?.link_ref || '').trim();
  return {
    ref: linkRef,
    link: String((notes as any)?.link_url || '').trim(),
    amount: Number(row?.amount || 0),
    customer_name: String(row?.customer_name || ''),
    customer_phone: String(row?.customer_phone || ''),
    customer_email: String(row?.customer_email || ''),
    status: String(row?.status || ''),
    order_id: row?.order_id ? String(row.order_id) : null,
    payment_id: row?.payment_id ? String(row.payment_id) : null,
    created_at: String(row?.created_at || ''),
    updated_at: row?.updated_at ? String(row.updated_at) : null,
  };
}

function canCancelStatus(value: unknown) {
  const status = String(value || '').trim().toUpperCase();
  return status === 'LINK_GENERATED' || status === 'CREATED' || status === 'FAILED';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
    const phoneFilter = (searchParams.get('phone') || '').replace(/\D/g, '');
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;
    let query = db
      .from('Razorpay_Direct_pay_RSA')
      .select('order_id, payment_id, amount, customer_name, customer_phone, customer_email, status, notes, created_at, updated_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (phoneFilter) {
      query = query.eq('customer_phone', phoneFilter);
    }

    const { data: rows, error } = await query.limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to fetch payment links' }, { status: 500 });
    }

    const out = (rows || [])
      .filter((row: any) => {
        if (phoneFilter) return true;
        const notes = row?.notes && typeof row.notes === 'object' ? row.notes : {};
        return String((notes as any)?.generated_by_profile_id || '') === String(profile.id || '');
      })
      .map(normalizeDirectPayRow)
      .filter((row: any) => row.ref && row.link)
      .slice(0, limit);

    return NextResponse.json({ success: true, rows: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount || 0);
    const customerName = String(body?.customer_name || '').trim();
    const customerPhone = String(body?.customer_phone || '').trim();
    const customerEmail = String(body?.customer_email || '').trim();
    const link = String(body?.link || '').trim();
    const ref = String(body?.ref || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Customer name and phone are required' }, { status: 400 });
    }
    if (!ref || !link) {
      return NextResponse.json({ error: 'Missing link ref or URL' }, { status: 400 });
    }

    const notes = {
      purpose: 'PAY_NOW',
      link_ref: ref,
      link_url: link,
      generated_by_profile_id: String(profile.id || ''),
      generated_by_user_id: String(user.id || ''),
      generated_by_name: String(profile.full_name || profile.email || user.email || ''),
      generated_by_role: roleCode,
    };

    const now = new Date().toISOString();
    const orderId = `LINK_${ref}`;
    const amountInPaise = Math.round(amount * 100);
    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;
    const { data: row, error } = await db
      .from('Razorpay_Direct_pay_RSA')
      .upsert(
        {
          order_id: orderId,
          amount,
          amount_paise: amountInPaise,
          currency: 'INR',
          status: 'LINK_GENERATED',
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone,
          notes,
          razorpay_payload: { source: 'telecaller_collect_payment', link },
          updated_at: now,
          created_at: now,
        },
        { onConflict: 'order_id' }
      )
      .select('order_id, payment_id, amount, customer_name, customer_phone, customer_email, status, notes, created_at, updated_at')
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message || 'Failed to save payment link' }, { status: 500 });
    }

    return NextResponse.json({ success: true, row: normalizeDirectPayRow(row) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const ref = String(body?.ref || '').trim();
    if (!ref) {
      return NextResponse.json({ error: 'ref is required' }, { status: 400 });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;
    const { data: rows, error } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('order_id, payment_id, amount, customer_name, customer_phone, customer_email, status, notes, created_at, updated_at')
      .gte('created_at', since)
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load payment links' }, { status: 500 });
    }

    const ownRows = (rows || []).filter((row: any) => {
      const notes = row?.notes && typeof row.notes === 'object' ? row.notes : {};
      const ownerProfileId = String((notes as any)?.generated_by_profile_id || '').trim();
      if (ownerProfileId && ownerProfileId !== String(profile.id || '')) return false;
      return String((notes as any)?.link_ref || '').trim() === ref;
    });

    if (ownRows.length === 0) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    const hasSettled = ownRows.some((row: any) => {
      const status = String(row?.status || '').trim().toUpperCase();
      return status === 'SUCCESS' || status === 'PAID' || status.includes('REFUND');
    });
    if (hasSettled) {
      return NextResponse.json({ error: 'Paid/refunded links cannot be cancelled' }, { status: 409 });
    }

    const cancellableRows = ownRows.filter((row: any) => canCancelStatus(row?.status));
    if (cancellableRows.length === 0) {
      const latest = ownRows[0];
      return NextResponse.json({ success: true, row: normalizeDirectPayRow(latest) }, { status: 200 });
    }

    const nowIso = new Date().toISOString();
    for (const row of cancellableRows) {
      const orderId = String(row?.order_id || '').trim();
      if (!orderId) continue;
      await db
        .from('Razorpay_Direct_pay_RSA')
        .update({ status: 'CANCELLED', updated_at: nowIso })
        .eq('order_id', orderId);
    }

    const latestByTime = [...ownRows, ...cancellableRows]
      .sort(
        (a: any, b: any) =>
          new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
          new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
      )
      .find(Boolean);

    const latest = latestByTime
      ? { ...latestByTime, status: 'CANCELLED', updated_at: nowIso }
      : { ref, link: '', status: 'CANCELLED', updated_at: nowIso };

    return NextResponse.json({ success: true, row: normalizeDirectPayRow(latest) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
