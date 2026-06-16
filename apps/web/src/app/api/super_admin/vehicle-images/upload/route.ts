import { createClient } from '@/lib/supabase/server';
import {
  VEHICLE_IMAGE_BUCKET,
  buildBrandImagePath,
  buildModelImagePath,
  getPublicUrlForStoragePath,
} from '@/lib/vehicleImages';
import { processVehicleImageUpload } from '@/lib/processVehicleImage';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 }) };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 }) };
  }

  return { ok: true as const, user };
}

/**
 * POST /api/super_admin/vehicle-images/upload
 * Upload a vehicle model or brand image to the same storage path used by the mobile app.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const make = String(formData.get('make') || '').trim();
    const model = String(formData.get('model') || '').trim();
    const imageType = String(formData.get('image_type') || 'model').trim();

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!make) return NextResponse.json({ error: 'Make is required' }, { status: 400 });

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG/PNG/WEBP allowed.' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 8MB' }, { status: 400 });
    }

    const isBrandOnly = imageType === 'brand';
    if (!isBrandOnly && !model) {
      return NextResponse.json({ error: 'Model is required for vehicle model images' }, { status: 400 });
    }

    const storagePath = isBrandOnly ? buildBrandImagePath(make) : buildModelImagePath(make, model);

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const buffer = await processVehicleImageUpload(inputBuffer);

    const { error: uploadError } = await supabase.storage.from(VEHICLE_IMAGE_BUCKET).upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload image', details: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      storage_path: storagePath,
      image_url: getPublicUrlForStoragePath(storagePath),
      message: isBrandOnly ? 'Brand image uploaded successfully' : 'Vehicle model image uploaded successfully',
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
