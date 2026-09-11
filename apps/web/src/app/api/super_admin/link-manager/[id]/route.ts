import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  assertShortCodeAvailable,
  ensureLinkDestinationIsPublic,
  ensureLinkQrUsesPublicUrl,
  generateQrDataUrl,
  shortCodeMetaFor,
} from '@/lib/link-manager/service';
import {
  buildQrShortUrl,
  buildShortUrl,
  normalizeLongUrl,
  normalizeStoredDestinationUrl,
  sanitizeCustomCode,
  shortBaseFromLinkMeta,
} from '@/lib/link-manager/utils';
import type { QrStyleOptions } from '@/lib/link-manager/qr-types';

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

  return { ok: true as const };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { id } = await params;
    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { data: link, error } = await supabaseAdmin.from('managed_short_links').select('*').eq('id', id).single();
    if (error || !link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    const withDestination = await ensureLinkDestinationIsPublic(supabaseAdmin, link);
    const base = shortBaseFromLinkMeta(withDestination.meta);
    const fixedLink = await ensureLinkQrUsesPublicUrl(supabaseAdmin, withDestination, base);

    const { data: clicks } = await supabaseAdmin
      .from('managed_short_link_clicks')
      .select('*')
      .eq('link_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({
      link: { ...fixedLink, short_url: buildShortUrl(fixedLink.short_code, base) },
      clicks: clicks || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { id } = await params;
    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body?.is_active === 'boolean') patch.is_active = body.is_active;
    if (body?.title !== undefined) patch.title = String(body.title || '').trim() || null;
    if (body?.description !== undefined) patch.description = String(body.description || '').trim() || null;
    if (body?.folder !== undefined) patch.folder = String(body.folder || '').trim().slice(0, 100) || null;
    if (body?.long_url !== undefined) {
      patch.long_url = normalizeStoredDestinationUrl(normalizeLongUrl(String(body.long_url || '')));
    }
    for (const field of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) {
      if (body?.[field] !== undefined) {
        patch[field] = String(body[field] || '').trim() || null;
      }
    }

    const requestedSlug = body?.short_code ?? body?.custom_code;
    if (requestedSlug !== undefined) {
      const { data: current, error: currentErr } = await supabaseAdmin
        .from('managed_short_links')
        .select('short_code, meta')
        .eq('id', id)
        .single();
      if (currentErr || !current) {
        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
      }
      try {
        const nextCode = await assertShortCodeAvailable(supabaseAdmin, String(requestedSlug || ''), id);
        if (nextCode !== sanitizeCustomCode(String(current.short_code || ''))) {
          const next = await shortCodeMetaFor(nextCode, current.meta as Record<string, unknown> | null);
          patch.short_code = next.short_code;
          patch.meta = next.meta;
        }
      } catch (slugErr: any) {
        const message = slugErr?.message || 'Invalid slug';
        const taken = /already (taken|used)/i.test(message);
        return NextResponse.json({ error: message }, { status: taken ? 409 : 400 });
      }
    }

    const { data: link, error } = await supabaseAdmin
      .from('managed_short_links')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !link) return NextResponse.json({ error: error?.message || 'Update failed' }, { status: 500 });

    const linkBase = shortBaseFromLinkMeta(link.meta);
    if (body?.regenerate_qr) {
      const shortUrl = buildShortUrl(link.short_code, linkBase);
      const qrPayload = buildQrShortUrl(link.short_code, linkBase);
      const savedStyle = (link.meta as any)?.qr_style as QrStyleOptions | undefined;
      const qrStyle = body?.qr_style && typeof body.qr_style === 'object' ? body.qr_style : savedStyle;
      const qrCodeUrl = await generateQrDataUrl(qrPayload, qrStyle || null);
      const meta = {
        ...(link.meta || {}),
        public_short_url: shortUrl,
        qr_payload: qrPayload,
        create_mode: 'qr_only',
      };
      const { data: updated } = await supabaseAdmin
        .from('managed_short_links')
        .update({ qr_code_url: qrCodeUrl, meta, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      return NextResponse.json({ link: { ...(updated || link), short_url: shortUrl } });
    }

    const withDestination = await ensureLinkDestinationIsPublic(supabaseAdmin, link);
    const fixedLink = await ensureLinkQrUsesPublicUrl(supabaseAdmin, withDestination, linkBase);
    return NextResponse.json({
      link: { ...fixedLink, short_url: buildShortUrl(fixedLink.short_code, linkBase) },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { id } = await params;
    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { error } = await supabaseAdmin.from('managed_short_links').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
