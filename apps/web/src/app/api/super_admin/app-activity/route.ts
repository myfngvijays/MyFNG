import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { phoneDigits } from '@/lib/customer-insights-admin';
import {
  friendlyAppEventName,
  summarizeAppEventProperties,
  type AppActivityItem,
} from '@/lib/app-activity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { supabaseAdmin } = getSupabaseAdmin();
  const db = supabaseAdmin || supabase;
  const profile = await resolveUserProfile(db as any, user);
  const roleCode = String((profile as any)?.roles?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin unavailable' }, { status: 500 });
    }

    const leadId = String(request.nextUrl.searchParams.get('lead_id') || '').trim();
    let customerId = String(request.nextUrl.searchParams.get('customer_id') || '').trim();
    let phone = String(request.nextUrl.searchParams.get('phone') || '').trim();

    if (leadId && (!customerId || !phone)) {
      const { data: lead } = await supabaseAdmin
        .from('service_leads')
        .select('id, customer_phone, meta, coupon_meta, created_from, lead_source, lead_number, created_at')
        .eq('id', leadId)
        .maybeSingle();
      if (lead) {
        phone = phone || String(lead.customer_phone || '');
        const meta =
          lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
        const coupon =
          lead.coupon_meta && typeof lead.coupon_meta === 'object'
            ? (lead.coupon_meta as Record<string, unknown>)
            : {};
        customerId =
          customerId ||
          String(meta.customer_id || coupon.customer_id || '').trim();
      }
    }

    const digits = phoneDigits(phone);
    if (!customerId && digits) {
      const { data: profiles } = await supabaseAdmin
        .from('customer_profiles')
        .select('id, phone')
        .or(`phone.eq.${digits},phone.eq.91${digits},phone.eq.+91${digits},phone.ilike.%${digits}`)
        .limit(5);
      const match = (profiles || []).find((p: any) => phoneDigits(p.phone) === digits) || profiles?.[0];
      if (match?.id) customerId = String(match.id);
    }

    const items: AppActivityItem[] = [];

    const safe = async (run: () => PromiseLike<{ data: any; error: any }>) => {
      const res = await run();
      if (res.error) return [] as any[];
      return Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
    };

    if (customerId) {
      const events = await safe(() =>
        supabaseAdmin
          .from('customer_analytics_events')
          .select('id, event_name, event_group, properties, created_at')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(80),
      );
      for (const ev of events) {
        items.push({
          id: `ev-${ev.id}`,
          kind: 'event',
          at: String(ev.created_at || ''),
          title: friendlyAppEventName(ev.event_name),
          body: summarizeAppEventProperties(ev.properties),
          group: ev.event_group ? String(ev.event_group) : null,
        });
      }

      const wallet = await safe(() =>
        supabaseAdmin
          .from('wallet_transactions')
          .select('id, transaction_type, amount, source, created_at')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(40),
      );
      for (const tx of wallet) {
        const amt = Math.abs(Number(tx.amount || 0));
        const type = String(tx.transaction_type || 'txn').replace(/_/g, ' ');
        items.push({
          id: `wal-${tx.id}`,
          kind: 'wallet',
          at: String(tx.created_at || ''),
          title: `Wallet ${type}${amt ? ` · ₹${Math.round(amt).toLocaleString('en-IN')}` : ''}`,
          body: tx.source ? String(tx.source) : null,
          group: 'wallet',
        });
      }

      const memberships = await safe(() =>
        supabaseAdmin
          .from('customer_memberships')
          .select('id, status, created_at, starts_at, expires_at, plan:membership_plans(code, name)')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(20),
      );
      for (const m of memberships) {
        const plan = Array.isArray(m.plan) ? m.plan[0] : m.plan;
        const planLabel = String(plan?.name || plan?.code || '').trim();
        items.push({
          id: `mem-${m.id}`,
          kind: 'membership',
          at: String(m.created_at || m.starts_at || ''),
          title: `Membership ${String(m.status || 'active').replace(/_/g, ' ')}`,
          body: [planLabel || null, m.expires_at ? `Expires ${String(m.expires_at).slice(0, 10)}` : null]
            .filter(Boolean)
            .join(' · ') || null,
          group: 'membership',
        });
      }
    }

    if (digits) {
      const bookings = await safe(() =>
        supabaseAdmin
          .from('service_leads')
          .select('id, lead_number, status, created_from, lead_source, created_at, service_type')
          .or(
            `customer_phone.eq.${digits},customer_phone.eq.91${digits},customer_phone.eq.+91${digits},customer_phone.ilike.%${digits}`,
          )
          .order('created_at', { ascending: false })
          .limit(30),
      );
      for (const b of bookings) {
        const from = `${b.created_from || ''} ${b.lead_source || ''}`.toUpperCase();
        if (!from.includes('APP')) continue;
        items.push({
          id: `bk-${b.id}`,
          kind: 'booking',
          at: String(b.created_at || ''),
          title: `App booking · ${b.lead_number || 'Lead'}`,
          body: [b.service_type, b.status].filter(Boolean).join(' · ') || null,
          group: 'booking',
        });
      }
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json({
      success: true,
      customer_id: customerId || null,
      phone: digits || null,
      items: items.slice(0, 120),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'App activity failed' }, { status: 500 });
  }
}
