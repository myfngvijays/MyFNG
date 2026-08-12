import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createManagedShortLink } from '@/lib/link-manager/service';

export const dynamic = 'force-dynamic';

const MAX_BULK = 100;

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, userId: user.id };
}

type BulkItem = {
  long_url: string;
  title?: string | null;
  custom_code?: string | null;
};

function applyTemplate(template: string, n: number, padded: string) {
  return template
    .replace(/\{n\}/gi, padded)
    .replace(/\{num\}/gi, padded)
    .replace(/\{#\}/g, padded);
}

function buildSeriesItems(series: any): BulkItem[] {
  const from = Math.floor(Number(series?.from));
  const to = Math.floor(Number(series?.to));
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error('Series from/to must be numbers');
  }
  if (from < 0 || to < 0) throw new Error('Series from/to must be >= 0');
  if (to < from) throw new Error('Series "to" must be >= "from"');
  if (to - from + 1 > MAX_BULK) {
    throw new Error(`Series too large (max ${MAX_BULK})`);
  }

  const longUrlTemplate = String(series?.long_url || '').trim();
  if (!longUrlTemplate) throw new Error('Series destination URL is required');

  const titleTemplate = String(series?.title_template || series?.title || '').trim();
  const slugTemplate = String(series?.slug_template || series?.custom_code || '').trim();
  const pad = Math.max(0, Math.min(6, Number(series?.pad) || 0));

  const items: BulkItem[] = [];
  for (let n = from; n <= to; n += 1) {
    const padded = pad > 0 ? String(n).padStart(pad, '0') : String(n);
    items.push({
      long_url: applyTemplate(longUrlTemplate, n, padded),
      title: titleTemplate ? applyTemplate(titleTemplate, n, padded) : `Link ${padded}`,
      custom_code: slugTemplate ? applyTemplate(slugTemplate, n, padded) : null,
    });
  }
  return items;
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const body = await request.json().catch(() => ({}));

    let items: BulkItem[] = [];
    if (body?.series && typeof body.series === 'object') {
      try {
        items = buildSeriesItems(body.series);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Invalid series' }, { status: 400 });
      }
    } else if (Array.isArray(body?.items) && body.items.length) {
      items = body.items
        .map((row: any) => ({
          long_url: String(row?.long_url || '').trim(),
          title: row?.title != null ? String(row.title) : null,
          custom_code: row?.custom_code != null ? String(row.custom_code).trim() : null,
        }))
        .filter((row: BulkItem) => row.long_url);
    } else {
      const urls: string[] = Array.isArray(body?.urls)
        ? body.urls.map((u: unknown) => String(u || '').trim()).filter(Boolean)
        : String(body?.urls_text || '')
            .split(/\n+/)
            .map((u) => u.trim())
            .filter(Boolean);
      items = urls.map((long_url) => ({
        long_url,
        title: body?.title || null,
        custom_code: null,
      }));
    }

    if (!items.length) {
      return NextResponse.json(
        { error: 'Provide series (from/to), items, or urls list' },
        { status: 400 },
      );
    }

    const createMode =
      body?.create_mode === 'qr_only' ? 'qr_only' : body?.create_mode === 'both' ? 'both' : 'link_only';

    let expiresAt: string | null = null;
    const expiresOption = String(body?.expires_option || 'never');
    const expiryDays: Record<string, number> = { '7': 7, '30': 30, '90': 90, '365': 365 };
    if (expiryDays[expiresOption]) {
      const dt = new Date();
      dt.setDate(dt.getDate() + expiryDays[expiresOption]);
      expiresAt = dt.toISOString();
    }

    const created: any[] = [];
    const errors: Array<{ url: string; code?: string | null; error: string }> = [];

    for (const item of items.slice(0, MAX_BULK)) {
      try {
        const link = await createManagedShortLink(supabaseAdmin, {
          long_url: item.long_url,
          title: item.title || body?.title || undefined,
          custom_code: item.custom_code || undefined,
          tags: Array.isArray(body?.tags) ? body.tags : [],
          folder: body?.folder || null,
          expires_at: expiresAt,
          created_by: gate.userId,
          create_mode: createMode,
          qr_style: createMode === 'link_only' ? null : body?.qr_style || null,
          utm_source: body?.utm_source || undefined,
          utm_medium: body?.utm_medium || undefined,
          utm_campaign: body?.utm_campaign || undefined,
          utm_term: body?.utm_term || undefined,
          utm_content: body?.utm_content || undefined,
        });
        created.push(link);
      } catch (e: any) {
        errors.push({
          url: item.long_url,
          code: item.custom_code,
          error: e?.message || 'Failed',
        });
      }
    }

    return NextResponse.json({
      created_count: created.length,
      links: created,
      errors,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bulk failed' }, { status: 500 });
  }
}
