import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { PUSH_FALLBACK_TEMPLATES } from '@/lib/push/push-admin-constants';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('push_notification_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      if (error.message?.includes('push_notification_templates')) {
        return NextResponse.json({ templates: PUSH_FALLBACK_TEMPLATES });
      }
      return NextResponse.json({ error: 'Failed to load templates', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      templates: (data || []).length > 0 ? data : PUSH_FALLBACK_TEMPLATES,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
