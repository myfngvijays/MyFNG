import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import type { Database } from '@/types/database';
import {
  VEHICLE_IMAGE_BUCKET,
  VEHICLE_IMAGE_PREFIX,
  formatLabelFromSlug,
  getPublicUrlForStoragePath,
  parseModelImagePath,
  type VehicleImageRow,
} from '@/lib/vehicleImages';
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

function getPublicStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createSupabaseClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listFolderEntries(supabase: any, folder: string) {
  const entries: any[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(VEHICLE_IMAGE_BUCKET).list(folder, { limit, offset });
    if (error) throw error;
    if (!data?.length) break;
    entries.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return entries;
}

function isStorageFolder(entry: { id?: string | null; metadata?: Record<string, unknown> | null; name?: string }) {
  return !entry.id && entry.metadata == null;
}

async function loadVehicleImages(supabase: any): Promise<VehicleImageRow[]> {
  const rows: VehicleImageRow[] = [];
  const rootEntries = await listFolderEntries(supabase, VEHICLE_IMAGE_PREFIX);

  for (const entry of rootEntries) {
    const name = String(entry.name || '');
    if (!name) continue;

    if (isStorageFolder(entry) && name.endsWith('-cars')) {
      const folderPath = `${VEHICLE_IMAGE_PREFIX}/${name}`;
      const files = await listFolderEntries(supabase, folderPath);
      for (const file of files) {
        if (isStorageFolder(file)) continue;
        if (!/\.png$/i.test(file.name)) continue;

        const storagePath = `${folderPath}/${file.name}`;
        const parsed = parseModelImagePath(storagePath);
        const makeSlug = parsed?.makeSlug || name.replace(/-cars$/, '');
        const modelSlug = parsed?.modelSlug || file.name.replace(/\.png$/i, '');

        rows.push({
          id: storagePath,
          type: 'model',
          make: formatLabelFromSlug(makeSlug),
          model: formatLabelFromSlug(modelSlug),
          make_slug: makeSlug,
          model_slug: modelSlug,
          storage_path: storagePath,
          image_url: getPublicUrlForStoragePath(storagePath),
          updated_at: file.updated_at || file.created_at || null,
        });
      }
      continue;
    }

    if (isStorageFolder(entry)) continue;
    if (!/\.png$/i.test(name)) continue;

    const storagePath = `${VEHICLE_IMAGE_PREFIX}/${name}`;
    if (name === 'default-car.png') {
      rows.push({
        id: storagePath,
        type: 'default',
        make: 'Default',
        model: null,
        make_slug: 'default-car',
        model_slug: null,
        storage_path: storagePath,
        image_url: getPublicUrlForStoragePath(storagePath),
        updated_at: entry.updated_at || entry.created_at || null,
      });
      continue;
    }

    const makeSlug = name.replace(/\.png$/i, '');
    rows.push({
      id: storagePath,
      type: 'brand',
      make: formatLabelFromSlug(makeSlug),
      model: null,
      make_slug: makeSlug,
      model_slug: null,
      storage_path: storagePath,
      image_url: getPublicUrlForStoragePath(storagePath),
      updated_at: entry.updated_at || entry.created_at || null,
    });
  }

  rows.sort((a, b) => {
    const makeCmp = a.make.localeCompare(b.make);
    if (makeCmp !== 0) return makeCmp;
    return String(a.model || '').localeCompare(String(b.model || ''));
  });

  return rows;
}

/**
 * GET /api/super_admin/vehicle-images
 * List vehicle model/brand images from Supabase storage.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    // Public bucket listing works with anon key; auth above ensures only super admins can call this.
    const publicStorage = getPublicStorageClient();
    if (!publicStorage) {
      return NextResponse.json({ error: 'Supabase public storage client unavailable' }, { status: 500 });
    }

    let data: VehicleImageRow[] = [];
    try {
      data = await loadVehicleImages(publicStorage);
    } catch (listError: any) {
      const { supabaseAdmin } = getSupabaseAdmin();
      if (supabaseAdmin) {
        data = await loadVehicleImages(supabaseAdmin);
      } else {
        console.error('vehicle-images list failed:', listError?.message);
        return NextResponse.json(
          { error: 'Failed to list vehicle images', details: listError?.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ data, count: data.length });
  } catch (e: any) {
    console.error('GET /api/super_admin/vehicle-images failed:', e);
    return NextResponse.json({ error: 'Failed to list vehicle images', details: e?.message }, { status: 500 });
  }
}

/**
 * DELETE /api/super_admin/vehicle-images
 * Body: { storage_path: "car-brands-images/skoda-cars/skoda-rapid.png" }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json().catch(() => ({}));
    const storagePath = String(body?.storage_path || '').trim();
    if (!storagePath.startsWith(`${VEHICLE_IMAGE_PREFIX}/`)) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
    }
    if (storagePath.endsWith('/default-car.png')) {
      return NextResponse.json({ error: 'Default vehicle image cannot be deleted' }, { status: 400 });
    }

    const { error: userDeleteError } = await supabase.storage.from(VEHICLE_IMAGE_BUCKET).remove([storagePath]);
    if (userDeleteError) {
      const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
      if (!supabaseAdmin) {
        return NextResponse.json(
          { error: 'Failed to delete image', details: userDeleteError.message || adminError },
          { status: 500 },
        );
      }
      const { error: adminDeleteError } = await supabaseAdmin.storage.from(VEHICLE_IMAGE_BUCKET).remove([storagePath]);
      if (adminDeleteError) {
        return NextResponse.json({ error: 'Failed to delete image', details: adminDeleteError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Vehicle image deleted' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
