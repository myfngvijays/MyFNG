import { assertPushAdmin } from '@/lib/push/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

const LIMITS = {
  icon: { maxBytes: 512 * 1024, label: 'icon' },
  banner: { maxBytes: 1024 * 1024, label: 'banner' },
} as const;

type UploadKind = keyof typeof LIMITS;

/**
 * POST /api/super_admin/notifications/upload-image
 * Upload push notification icon or rich banner image to Supabase storage.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kindRaw = String(formData.get('kind') || 'banner').trim().toLowerCase();
    const kind: UploadKind = kindRaw === 'icon' ? 'icon' : 'banner';
    const title = String(formData.get('title') || kind).trim();

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, or WEBP allowed.' }, { status: 400 });
    }

    const limit = LIMITS[kind];
    if (file.size > limit.maxBytes) {
      const maxMb = kind === 'icon' ? '512 KB' : '1 MB';
      return NextResponse.json({ error: `File size must be less than ${maxMb}` }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const sanitized =
      String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 48) || kind;
    const fileName = `${kind}-${sanitized}-${Date.now()}.${fileExt}`;
    const filePath = `Push Notifications/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = 'App';

    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload image', details: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return NextResponse.json({
      success: true,
      image_url: publicUrlData.publicUrl,
      file_path: filePath,
      bucket,
      kind,
      message: 'Image uploaded successfully',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
