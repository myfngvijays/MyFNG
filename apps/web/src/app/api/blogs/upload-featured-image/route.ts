import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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

const ALLOWED_EXTS = new Set(['webp', 'jpg', 'jpeg', 'png']);

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

    const name = String((file as any)?.name || 'upload');
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `Invalid file type. Allowed: ${Array.from(ALLOWED_EXTS).join(', ')}` }, { status: 400 });
    }

    // IMPORTANT: filename must match slug for backend validation
    const filePath = `blog-images/${slug}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabaseAdmin.storage.from('service-media').upload(filePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
      cacheControl: '3600',
    });
    if (upErr) {
      return NextResponse.json({ error: 'Failed to upload image', details: upErr.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from('service-media').getPublicUrl(filePath);
    const url = urlData?.publicUrl || null;
    if (!url) return NextResponse.json({ error: 'Failed to generate public URL' }, { status: 500 });

    return NextResponse.json({ success: true, url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

