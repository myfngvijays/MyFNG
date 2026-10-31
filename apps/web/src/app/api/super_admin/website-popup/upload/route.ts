import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { mediaPathFromStorage } from '@/lib/media/public-url';
import { WEBSITE_POPUP_IMAGE } from '@/lib/website-offer-popup';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_WEBP_BYTES = 450 * 1024;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData, error: roleError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();
    const roleCode = (userData as { roles?: { role_code?: string } } | null)?.roles?.role_code;
    if (roleError || !userData || !['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Choose an image' }, { status: 400 });
    if (!String(file.type || '').startsWith('image/') || file.type === 'image/svg+xml') {
      return NextResponse.json({ error: 'Upload a JPG, PNG, or WEBP image' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image must be under 8MB' }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input).metadata().catch(() => null);
    const originalW = meta?.width || 0;
    const originalH = meta?.height || 0;
    const targetRatio = WEBSITE_POPUP_IMAGE.width / WEBSITE_POPUP_IMAGE.height;
    const originalRatio = originalW && originalH ? originalW / originalH : targetRatio;
    const cropped = Math.abs(originalRatio - targetRatio) > 0.04 || originalW !== WEBSITE_POPUP_IMAGE.width || originalH !== WEBSITE_POPUP_IMAGE.height;

    let quality = 82;
    let webp = input;
    for (let i = 0; i < 8; i += 1) {
      webp = await sharp(input)
        .rotate()
        .resize(WEBSITE_POPUP_IMAGE.width, WEBSITE_POPUP_IMAGE.height, { fit: 'cover', position: 'centre' })
        .webp({ quality, effort: 5 })
        .toBuffer();
      if (webp.byteLength <= MAX_WEBP_BYTES) break;
      quality = Math.max(50, quality - 6);
    }

    const { supabaseAdmin, error } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: error || 'Storage unavailable' }, { status: 500 });

    const filePath = `website-popups/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const { error: upErr } = await supabaseAdmin.storage.from('service-media').upload(filePath, webp, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '3600',
    });
    if (upErr) return NextResponse.json({ error: upErr.message || 'Upload failed' }, { status: 500 });

    return NextResponse.json({
      success: true,
      url: mediaPathFromStorage('service-media', filePath),
      width: WEBSITE_POPUP_IMAGE.width,
      height: WEBSITE_POPUP_IMAGE.height,
      cropped,
      original_width: originalW || null,
      original_height: originalH || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Upload failed' }, { status: 500 });
  }
}
