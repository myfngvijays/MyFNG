import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createManagedShortLink } from '@/lib/link-manager/service';

export const dynamic = 'force-dynamic';

async function requireApiKey(request: NextRequest) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false as const, status: 500, error: 'Server not configured' };

  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'link_manager_api_key')
    .maybeSingle();

  const configured = String(data?.setting_value || '').trim();
  if (!configured) {
    return { ok: false as const, status: 503, error: 'Link Manager API key not configured' };
  }

  const headerKey =
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (!headerKey || headerKey !== configured) {
    return { ok: false as const, status: 401, error: 'Invalid API key' };
  }

  return { ok: true as const, supabaseAdmin };
}

function expiresAtFromBody(body: any): string | null {
  const expiresOption = String(body?.expires_option || 'never').trim();
  const expiryDays: Record<string, number> = { '7': 7, '30': 30, '90': 90, '365': 365 };
  if (expiryDays[expiresOption]) {
    const dt = new Date();
    dt.setDate(dt.getDate() + expiryDays[expiresOption]);
    return dt.toISOString();
  }
  if (Number(body?.expires_in_days) > 0) {
    const dt = new Date();
    dt.setDate(dt.getDate() + Number(body.expires_in_days));
    return dt.toISOString();
  }
  return null;
}

/** External create: POST /api/public/link-manager/v1  (header x-api-key) */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireApiKey(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const createMode =
      body?.create_mode === 'qr_only' ? 'qr_only' : body?.create_mode === 'both' ? 'both' : 'link_only';

    // Bulk: { links: [ { long_url, title, ... }, ... ] }
    if (Array.isArray(body?.links)) {
      const rows = body.links.slice(0, 100);
      const created: any[] = [];
      const errors: Array<{ index: number; error: string }> = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const link = await createManagedShortLink(gate.supabaseAdmin, {
            ...row,
            long_url: row.long_url,
            expires_at: expiresAtFromBody(row),
            create_mode: row.create_mode === 'qr_only' || row.create_mode === 'both' ? row.create_mode : createMode,
          });
          created.push(link);
        } catch (e: any) {
          errors.push({ index: i, error: e?.message || 'Failed' });
        }
      }
      return NextResponse.json({ created_count: created.length, links: created, errors }, { status: 201 });
    }

    const link = await createManagedShortLink(gate.supabaseAdmin, {
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
      expires_at: expiresAtFromBody(body),
      create_mode: createMode,
      password: body?.password,
      max_clicks: body?.max_clicks,
      expired_redirect_url: body?.expired_redirect_url,
      folder: body?.folder,
      ios_url: body?.ios_url,
      android_url: body?.android_url,
      desktop_url: body?.desktop_url,
      app_deep_link: body?.app_deep_link,
      og_title: body?.og_title,
      og_description: body?.og_description,
      og_image_url: body?.og_image_url,
      enable_landing: Boolean(body?.enable_landing),
      webhook_url: body?.webhook_url,
      pixel_meta_id: body?.pixel_meta_id,
      pixel_google_id: body?.pixel_google_id,
      ab_variants: body?.ab_variants,
      geo_rules: body?.geo_rules,
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 400 });
  }
}
