import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from('push_saved_segments')
    .select('id, name, description, filters, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    if (String(error.message || '').includes('push_saved_segments')) {
      return NextResponse.json({
        segments: [],
        missing_table: true,
        hint: 'Run database/294_push_campaigns_segments_schedule.sql',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ segments: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const description = String(body?.description || '').trim();
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {};

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('push_saved_segments')
    .insert({
      name,
      description: description || null,
      filters,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .select('id, name, description, filters, created_at, updated_at')
    .maybeSingle();

  if (error) {
    if (String(error.message || '').includes('duplicate') || String(error.code) === '23505') {
      return NextResponse.json({ error: 'Segment name already exists' }, { status: 409 });
    }
    if (String(error.message || '').includes('push_saved_segments')) {
      return NextResponse.json(
        { error: 'Missing table. Run database/294_push_campaigns_segments_schedule.sql' },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ segment: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });

  const id = new URL(request.url).searchParams.get('id')?.trim() || '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('push_saved_segments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
