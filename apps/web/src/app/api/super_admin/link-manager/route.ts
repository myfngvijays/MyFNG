import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { buildShortUrl, createManagedShortLink } from '@/lib/link-manager/service';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize') || 25)));
    const q = String(params.get('q') || '').trim();

    let query = supabaseAdmin
      .from('managed_short_links')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(
        `title.ilike.%${q}%,short_code.ilike.%${q}%,long_url.ilike.%${q}%`,
      );
    }

    const fromIdx = (page - 1) * pageSize;
    const { data, error, count } = await query.range(fromIdx, fromIdx + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const links = (data || []).map((row: any) => ({
      ...row,
      short_url: buildShortUrl(row.short_code),
    }));

    return NextResponse.json({
      links,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const expiresOption = String(body?.expires_option || 'never').trim();
    let expiresAt: string | null = null;
    const expiryDays: Record<string, number> = { '7': 7, '30': 30, '90': 90, '365': 365 };
    if (expiryDays[expiresOption]) {
      const dt = new Date();
      dt.setDate(dt.getDate() + expiryDays[expiresOption]);
      expiresAt = dt.toISOString();
    } else if (Number(body?.expires_in_days) > 0) {
      const dt = new Date();
      dt.setDate(dt.getDate() + Number(body.expires_in_days));
      expiresAt = dt.toISOString();
    }

    const link = await createManagedShortLink(supabaseAdmin, {
      long_url: body?.long_url,
      title: body?.title,
      description: body?.description,
      tags: Array.isArray(body?.tags) ? body.tags : String(body?.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
      custom_code: body?.custom_code,
      utm_source: body?.utm_source,
      utm_medium: body?.utm_medium,
      utm_campaign: body?.utm_campaign,
      utm_term: body?.utm_term,
      utm_content: body?.utm_content,
      expires_at: expiresAt,
      created_by: gate.userId,
      qr_style: body?.qr_style && typeof body.qr_style === 'object' ? body.qr_style : null,
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 400 });
  }
}
