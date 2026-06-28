import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { PUSH_HISTORY_LOG_TYPES } from '@/lib/push/notificationLog';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const params = request.nextUrl.searchParams;
    const status = params.get('status')?.trim().toUpperCase();
    const role = params.get('role')?.trim().toUpperCase();
    const q = params.get('q')?.trim();
    const limit = Math.min(Math.max(Number(params.get('limit') || 50), 1), 200);
    const offset = Math.max(Number(params.get('offset') || 0), 0);

    let query = supabaseAdmin
      .from('notification_logs')
      .select('*', { count: 'exact' })
      .in('type', [...PUSH_HISTORY_LOG_TYPES])
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }
    if (role && role !== 'ALL') {
      query = query.eq('recipient', role);
    }
    if (q) {
      query = query.or(`message.ilike.%${q}%,recipient.ilike.%${q}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch history', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
