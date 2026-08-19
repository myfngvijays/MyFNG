import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function last10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function normalizeE164(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const l10 = digits.slice(-10);
  if (l10.length === 10) return `91${l10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
}

async function requireManager(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: String((profile as any)?.id || user.id) };
}

/** GET /api/lead-manager/whatsapp-dnd — list DND numbers */
export async function GET(request: NextRequest) {
  const gate = await requireManager(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const q = String(request.nextUrl.searchParams.get('q') || '').trim();
  let query = supabaseAdmin
    .from('whatsapp_dnd_numbers')
    .select('id, phone_e164, phone_last10, reason, source, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (q) {
    const l10 = last10(q);
    if (l10) query = query.or(`phone_last10.eq.${l10},phone_e164.ilike.%${l10}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (String(error.message || '').includes('whatsapp_dnd_numbers')) {
      return NextResponse.json({
        numbers: [],
        warning: 'Run database/317_crm_manager_ops_tags_views_dnd.sql',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ numbers: data || [] });
}

/** POST add | DELETE remove */
export async function POST(request: NextRequest) {
  const gate = await requireManager(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json().catch(() => ({}));
  const phone = normalizeE164(String(body?.phone || ''));
  const l10 = last10(phone);
  const reason = String(body?.reason || '').trim() || null;

  if (l10.length !== 10) {
    return NextResponse.json({ error: 'Valid 10-digit phone required' }, { status: 400 });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from('whatsapp_dnd_numbers')
    .upsert(
      {
        phone_e164: phone,
        phone_last10: l10,
        reason,
        source: 'manual',
        created_by: gate.userId,
      },
      { onConflict: 'phone_last10' },
    )
    .select('id, phone_e164, phone_last10, reason, source, created_at')
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes('whatsapp_dnd')
          ? 'Run database/317_crm_manager_ops_tags_views_dnd.sql'
          : error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, number: data });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireManager(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const id = String(request.nextUrl.searchParams.get('id') || '').trim();
  const phone = last10(String(request.nextUrl.searchParams.get('phone') || ''));
  if (!id && phone.length !== 10) {
    return NextResponse.json({ error: 'id or phone required' }, { status: 400 });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  let query = supabaseAdmin.from('whatsapp_dnd_numbers').delete();
  if (id) query = query.eq('id', id);
  else query = query.eq('phone_last10', phone);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
