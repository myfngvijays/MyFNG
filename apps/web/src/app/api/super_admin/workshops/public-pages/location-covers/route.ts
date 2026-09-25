import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/supabase/requestUser';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizeRoleCode } from '@/lib/telecaller/crmRoles';
import {
  renderWorkshopLocationCover,
  workshopCoverFileSlug,
  workshopLocationCoverTitle,
} from '@/lib/workshop/locationCover';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const auth = await getRequestUser(supabase, request);
  if (!auth.ok) return { ok: false as const, res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const { supabaseAdmin } = getSupabaseAdmin();
  const profile = await resolveUserProfile(supabase, auth.user, supabaseAdmin);
  const roleCode = normalizeRoleCode((profile as { roles?: { role_code?: string } })?.roles?.role_code);
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true as const, db: (supabaseAdmin ?? supabase) as any };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return gate.res;

    const { data: pages, error } = await gate.db
      .from('workshop_public_pages')
      .select('id, slug, gmb_data, workshop:workshops(id, name, workshop_name, city)')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const updated: Array<{ id: string; title: string; cover_image: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const page of pages || []) {
      const workshop = page.workshop || {};
      const title = workshopLocationCoverTitle({
        workshop_name: workshop.workshop_name,
        name: workshop.name,
        city: workshop.city,
        gmb_business_name: page.gmb_data?.business_name,
      });
      try {
        const png = await renderWorkshopLocationCover(title);
        const filePath = `workshop-public-pages/location-covers/${workshopCoverFileSlug(title, page.slug)}.png`;
        const { error: upErr } = await gate.db.storage
          .from('workshop-assets')
          .upload(filePath, png, { contentType: 'image/png', upsert: true, cacheControl: '3600' });
        if (upErr) throw upErr;
        const { data: pub } = gate.db.storage.from('workshop-assets').getPublicUrl(filePath);
        const cover_image = `${pub.publicUrl}?v=${Date.now()}`;
        const { error: saveErr } = await gate.db
          .from('workshop_public_pages')
          .update({ cover_image, updated_at: new Date().toISOString() })
          .eq('id', page.id);
        if (saveErr) throw saveErr;
        updated.push({ id: page.id, title, cover_image });
      } catch (e: any) {
        failed.push({ id: page.id, error: e?.message || 'Failed' });
      }
    }

    return NextResponse.json({
      success: true,
      count: updated.length,
      failed: failed.length,
      updated,
      errors: failed,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Location covers failed' }, { status: 500 });
  }
}
