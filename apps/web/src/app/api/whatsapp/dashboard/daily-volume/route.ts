import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enumerateYmdRange, resolveReportDateRange } from '@/lib/report-date-range';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const MAX_DAILY_CHART_DAYS = 30;

const ALLOWED_CHART_PRESETS = new Set([
  'today',
  'yesterday',
  'last_7_days',
  'last_14_days',
  'last_30_days',
  'custom',
]);

type MessageRow = {
  status?: string | null;
  created_at?: string | null;
  direction?: string | null;
  message_type?: string | null;
};

function normStatus(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function isOutboundTemplate(row: MessageRow) {
  return normStatus(row.direction) === 'OUTBOUND' && normStatus(row.message_type) === 'TEMPLATE';
}

function dayKey(iso: string | null | undefined) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(iso).slice(0, 10);
  }
}

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const preset = String(request.nextUrl.searchParams.get('preset') || 'last_7_days').trim().toLowerCase();
    const customStart = request.nextUrl.searchParams.get('start');
    const customEnd = request.nextUrl.searchParams.get('end');

    if (!ALLOWED_CHART_PRESETS.has(preset)) {
      return NextResponse.json(
        { error: 'Invalid chart preset. Use today, yesterday, last 7/14/30 days, or custom.' },
        { status: 400 }
      );
    }

    if (preset === 'custom' && (!customStart || !customEnd)) {
      return NextResponse.json({ error: 'Custom chart range requires start and end dates.' }, { status: 400 });
    }

    const range = resolveReportDateRange(preset, customStart, customEnd);
    const dayList = enumerateYmdRange(range.startYmd, range.endYmd);

    if (dayList.length > MAX_DAILY_CHART_DAYS) {
      return NextResponse.json(
        {
          error: `Daily chart supports up to ${MAX_DAILY_CHART_DAYS} days. Selected range spans ${dayList.length} days.`,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: messageRows, error: messageError } = await db
      .from('whatsapp_messages')
      .select('status, created_at, direction, message_type')
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(10000);

    if (messageError) {
      return NextResponse.json({ error: messageError.message || 'Failed to fetch messages' }, { status: 500 });
    }

    const dailyVolumeMap = new Map<
      string,
      { date: string; sent: number; delivered: number; read: number; failed: number }
    >();

    for (const row of ((messageRows || []) as MessageRow[]).filter(isOutboundTemplate)) {
      const key = dayKey(row.created_at);
      if (!key) continue;
      const current = dailyVolumeMap.get(key) || { date: key, sent: 0, delivered: 0, read: 0, failed: 0 };
      const status = normStatus(row.status);
      if (['SENT', 'DELIVERED', 'VIEWED'].includes(status)) current.sent += 1;
      if (['DELIVERED', 'VIEWED'].includes(status)) current.delivered += 1;
      if (status === 'VIEWED') current.read += 1;
      if (status === 'FAILED') current.failed += 1;
      dailyVolumeMap.set(key, current);
    }

    const dailyVolume = dayList.map((date) => dailyVolumeMap.get(date) || {
      date,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    });

    const sentTotal = dailyVolume.reduce((sum, row) => sum + row.sent, 0);

    return NextResponse.json({
      success: true,
      preset,
      range_label: range.label,
      start_ymd: range.startYmd,
      end_ymd: range.endYmd,
      max_days: MAX_DAILY_CHART_DAYS,
      shown_days: dailyVolume.length,
      sent_total: sentTotal,
      daily_volume: dailyVolume,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
