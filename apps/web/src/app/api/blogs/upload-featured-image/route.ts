import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) return { supabaseAdmin: null as any, error: 'SUPABASE_SERVICE_ROLE_KEY not set' };
  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null };
}

const MAX_BYTES = 200 * 1024; // 200KB
const TARGET_W = 1980;
const TARGET_H = 1080;

async function toWebpUnderSize(input: Buffer): Promise<{ webp: Buffer; quality: number }> {
  // Start reasonably high; step down until <= MAX_BYTES or floor.
  let quality = 82;
  for (let i = 0; i < 8; i++) {
    const out = await sharp(input)
      .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (out.byteLength <= MAX_BYTES) return { webp: out, quality };
    quality = Math.max(45, quality - 8);
  }
  // Return best-effort last attempt
  const out = await sharp(input)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
    .webp({ quality: 45, effort: 6 })
    .toBuffer();
  return { webp: out, quality: 45 };
}

export async function POST(request: NextRequest) {
  try {
    const { supabaseAdmin, error } = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const slug = String(formData.get('slug') || '').trim();

    if (!file || !slug) {
      return NextResponse.json({ error: 'file and slug are required' }, { status: 400 });
    }

    if (!String(file.type || '').startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image.' }, { status: 400 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input).metadata().catch(() => null);
    const originalW = meta?.width || null;
    const originalH = meta?.height || null;
    const originalRatio = originalW && originalH ? originalW / originalH : null;
    const targetRatio = TARGET_W / TARGET_H;
    const aspectOff = originalRatio ? Math.abs(originalRatio - targetRatio) > 0.02 : false;

    const { webp, quality } = await toWebpUnderSize(input);

    // IMPORTANT: filename must match slug for backend validation (.webp enforced)
    const filePath = `blog-images/${slug}.webp`;

    const { error: upErr } = await supabaseAdmin.storage.from('service-media').upload(filePath, webp, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '3600',
    });
    if (upErr) {
      return NextResponse.json({ error: 'Failed to upload image', details: upErr.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from('service-media').getPublicUrl(filePath);
    const url = urlData?.publicUrl || null;
    if (!url) return NextResponse.json({ error: 'Failed to generate public URL' }, { status: 500 });

    return NextResponse.json(
      {
        success: true,
        url,
        info: {
          converted: true,
          quality,
          bytes: webp.byteLength,
          resized_to: `${TARGET_W}x${TARGET_H}`,
          aspect_ratio_warning: aspectOff ? 'Original aspect ratio differs; image was center-cropped to 1980x1080.' : null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

