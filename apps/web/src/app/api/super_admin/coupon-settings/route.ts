import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

const SETTING_KEY = 'advance_coupon_settings';

async function assertAdmin() {
  // Reuse push admin auth (SUPER_ADMIN / SUB_ADMIN)
  return assertPushAdmin();
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ settings: null });

  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle();

  let settings = null;
  const raw = data?.setting_value;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      settings = JSON.parse(raw);
    } catch {
      settings = null;
    }
  } else if (raw && typeof raw === 'object') {
    settings = raw;
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const settings = body?.settings && typeof body.settings === 'object' ? body.settings : null;
  if (!settings) return NextResponse.json({ error: 'settings required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: JSON.stringify(settings),
      setting_type: 'JSON',
      category: 'COUPONS',
      is_editable: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings });
}
