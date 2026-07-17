import { listBlogSeoSummaries } from '@/lib/blog/seo';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const data = await listBlogSeoSummaries();
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
