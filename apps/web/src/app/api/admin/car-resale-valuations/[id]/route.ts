import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, error: adminErr } = getAdminDb();
    if (!db) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { id: rawId } = await params;
    const id = String(rawId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data, error } = await db
      .from('car_resale_valuations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ item: data });
  } catch (error: any) {
    console.error('[admin/car-resale-valuations/[id]][GET]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
