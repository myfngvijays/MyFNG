import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(supabase: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 }) };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 }) };
  }

  return { ok: true, user };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = (formData.get('title') as string) || 'rsa-banner';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG/PNG/WEBP allowed.' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 8MB' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const sanitized = String(title).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 48) || 'rsa-banner';
    const fileName = `${sanitized}-${Date.now()}.${fileExt}`;
    const filePath = `Mobile Screen - Hero Section/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
      message: 'Image uploaded successfully',
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
