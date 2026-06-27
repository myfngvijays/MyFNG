import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { fetchSmartToolCustomerActivity } from '@/lib/smart-tools-customer-activity';
import { requireSuperAdmin } from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { db: null as any, error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' };
  const db = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, error: adminErr } = getAdminDb();
    if (!db) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { searchParams } = request.nextUrl;
    const customerId = searchParams.get('customer_id');
    const customerPhone = searchParams.get('phone') || searchParams.get('customer_phone');
    const excludeType = searchParams.get('exclude_type') as 'health' | 'resale' | null;
    const excludeId = searchParams.get('exclude_id');

    const activity = await fetchSmartToolCustomerActivity(db, {
      customerId,
      customerPhone,
      excludeType: excludeType || undefined,
      excludeId: excludeId || undefined,
    });

    return NextResponse.json(activity);
  } catch (error: any) {
    console.error('[admin/smart-tools/customer-activity][GET]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
