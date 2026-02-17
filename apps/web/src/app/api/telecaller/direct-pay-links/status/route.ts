import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

async function fetchCapturedPaymentForOrder(orderId: string) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !orderId) return null;

  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    },
  });
  if (!response.ok) return null;
  const json = await response.json().catch(() => ({}));
  const items = Array.isArray(json?.items) ? json.items : [];
  const captured = items.find((item: any) => {
    const status = String(item?.status || '').toLowerCase();
    return status === 'captured' || status === 'authorized';
  });
  return captured || null;
}

async function resolveUserProfile(supabase: any, user: any) {
  const email = (user?.email || '').trim();
  const phone = (user?.phone || '').trim();
  const selectProfile = 'id, email, phone, roles!inner(role_code)';

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
    const refsInput = Array.isArray(body?.refs) ? body.refs : [];
    const refs = Array.from(
      new Set(
        refsInput
          .map((item: any) => String(item || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 200);

    if (refs.length === 0) {
      return NextResponse.json({ success: true, rows: [] }, { status: 200 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;
    const nowIso = new Date().toISOString();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('order_id, payment_id, status, notes, created_at, updated_at')
      .gte('created_at', since)
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to fetch payment links' }, { status: 500 });
    }
    let workingRows: any[] = Array.isArray(rows) ? [...rows] : [];

    // Reconcile stale CREATED rows from Razorpay in case webhook/client verify was missed.
    const staleRows = workingRows.filter((row: any) => {
      const notes = row?.notes && typeof row.notes === 'object' ? row.notes : {};
      const ownerProfileId = String((notes as any)?.generated_by_profile_id || '').trim();
      if (ownerProfileId && ownerProfileId !== String(profile.id || '')) return false;
      const linkRef = String((notes as any)?.link_ref || '').trim();
      if (!linkRef || !refs.includes(linkRef)) return false;
      const status = String(row?.status || '').toUpperCase();
      return (status === 'CREATED' || status === 'LINK_GENERATED') && String(row?.order_id || '').startsWith('order_');
    });

    if (staleRows.length > 0) {
      await Promise.all(
        staleRows.map(async (row: any) => {
          const orderId = String(row?.order_id || '').trim();
          if (!orderId) return;
          try {
            const captured = await fetchCapturedPaymentForOrder(orderId);
            if (!captured?.id) return;
            await db
              .from('Razorpay_Direct_pay_RSA')
              .update({
                payment_id: String(captured.id),
                amount: Number.isFinite(Number(captured.amount)) ? Number(captured.amount) / 100 : row?.amount ?? null,
                amount_paise: Number.isFinite(Number(captured.amount)) ? Number(captured.amount) : row?.amount_paise ?? null,
                currency: String(captured.currency || row?.currency || 'INR'),
                status: 'SUCCESS',
                razorpay_payload: captured,
                updated_at: nowIso,
              })
              .eq('order_id', orderId);
          } catch {
            // Ignore reconciliation failures per row; return best-effort status.
          }
        })
      );

      // Reload latest rows after best-effort reconciliation.
      const refreshed = await db
        .from('Razorpay_Direct_pay_RSA')
        .select('order_id, payment_id, status, notes, created_at, updated_at')
        .gte('created_at', since)
        .order('updated_at', { ascending: false })
        .limit(1000);
      if (!refreshed.error && Array.isArray(refreshed.data)) {
        workingRows = refreshed.data;
      }
    }

    const refSet = new Set(refs);
    const latestByRef = new Map<string, any>();

    for (const row of workingRows) {
      const notes = row?.notes && typeof row.notes === 'object' ? row.notes : {};
      const ownerProfileId = String((notes as any)?.generated_by_profile_id || '').trim();
      if (ownerProfileId && ownerProfileId !== String(profile.id || '')) continue;
      const linkRef = String((notes as any)?.link_ref || '').trim();
      if (!linkRef || !refSet.has(linkRef)) continue;

      const currentTs = new Date(row?.updated_at || row?.created_at || 0).getTime();
      const existing = latestByRef.get(linkRef);
      const existingTs = existing ? new Date(existing.updated_at || 0).getTime() : -1;
      if (!existing || currentTs >= existingTs) {
        latestByRef.set(linkRef, {
          link_ref: linkRef,
          order_id: row?.order_id || null,
          payment_id: row?.payment_id || null,
          status: row?.status || null,
          updated_at: row?.updated_at || row?.created_at || null,
        });
      }
    }

    return NextResponse.json({ success: true, rows: Array.from(latestByRef.values()) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
