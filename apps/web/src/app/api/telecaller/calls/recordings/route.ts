import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
      .trim()
      .toUpperCase();
    if (!ALLOWED.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const userId = String((profile as { id?: string } | null)?.id || '').trim();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin || supabase) as any;
    const q = String(request.nextUrl.searchParams.get('q') || '')
      .trim()
      .toLowerCase()
      .slice(0, 40);

    let query = db
      .from('telecaller_call_logs')
      .select(
        'id, lead_id, phone_number, created_at, call_duration, telecaller_id, call_recording_url, lead:service_leads!lead_id(lead_number, customer_name, customer_phone, assigned_telecaller_id)',
      )
      .not('call_recording_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(150);

    if (roleCode === 'TELECALLER' && userId) query = query.eq('telecaller_id', userId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (data || [])
      .filter((row: any) => {
        if (roleCode !== 'TELECALLER') return true;
        const assigned = String(row?.lead?.assigned_telecaller_id || '');
        return !assigned || assigned === userId || String(row.telecaller_id || '') === userId;
      })
      .map((row: any) => ({
        id: row.id,
        lead_id: row.lead_id,
        lead_number: row.lead?.lead_number || '',
        customer_name: row.lead?.customer_name || '',
        phone: row.lead?.customer_phone || row.phone_number || '',
        created_at: row.created_at,
        duration: row.call_duration || 0,
      }))
      .filter((row: { customer_name: string; phone: string; lead_number: string }) => {
        if (!q) return true;
        return [row.customer_name, row.phone, row.lead_number].join(' ').toLowerCase().includes(q);
      });

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
