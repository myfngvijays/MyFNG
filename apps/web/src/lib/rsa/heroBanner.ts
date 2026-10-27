import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const SETTING_KEY = 'rsa_screen_hero_banners';

export type RsaHeroBannerRow = {
  id: string;
  title: string | null;
  image_url: string;
  route_name: string;
  route_params: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function parseRows(raw: unknown): RsaHeroBannerRow[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row === 'object' && typeof row.image_url === 'string');
  } catch {
    return [];
  }
}

async function readRows(): Promise<{ rows: RsaHeroBannerRow[]; error?: string }> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) return { rows: [], error: error || 'Database admin client unavailable' };
  const { data, error: readError } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle();
  if (readError) return { rows: [], error: readError.message };
  return { rows: parseRows(data?.setting_value) };
}

async function writeRows(rows: RsaHeroBannerRow[]): Promise<{ error?: string }> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) return { error: error || 'Database admin client unavailable' };
  const { error: writeError } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: JSON.stringify(rows),
      setting_type: 'JSON',
      category: 'INTEGRATIONS',
      description: 'RSA mobile screen hero banner (image, route, active).',
      default_value: '[]',
      is_editable: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (writeError) return { error: writeError.message };
  return {};
}

function sortRows(rows: RsaHeroBannerRow[]): RsaHeroBannerRow[] {
  return [...rows].sort((a, b) => {
    const order = Number(a.display_order || 0) - Number(b.display_order || 0);
    if (order !== 0) return order;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export async function listRsaHeroBanners(): Promise<{ data: RsaHeroBannerRow[]; error?: string }> {
  const { rows, error } = await readRows();
  if (error) return { data: [], error };
  return { data: sortRows(rows) };
}

export async function getActiveRsaHeroBanner(): Promise<RsaHeroBannerRow | null> {
  const { rows } = await readRows();
  return (
    sortRows(rows).find((row) => row.is_active && row.image_url) || null
  );
}

export async function createRsaHeroBanner(input: {
  title?: string | null;
  image_url: string;
  route_name?: string;
  route_params?: Record<string, unknown>;
  display_order?: number;
  is_active?: boolean;
}): Promise<{ data?: RsaHeroBannerRow; error?: string }> {
  const { rows, error } = await readRows();
  if (error) return { error };
  const now = new Date().toISOString();
  const row: RsaHeroBannerRow = {
    id: crypto.randomUUID(),
    title: input.title || null,
    image_url: input.image_url,
    route_name: input.route_name || 'RoadsideAssistance',
    route_params: input.route_params || {},
    display_order: Number.isFinite(Number(input.display_order)) ? Number(input.display_order) : 0,
    is_active: input.is_active !== undefined ? !!input.is_active : true,
    created_at: now,
    updated_at: now,
  };
  const saved = await writeRows([row, ...rows]);
  if (saved.error) return { error: saved.error };
  return { data: row };
}

export async function updateRsaHeroBanner(
  id: string,
  patch: Partial<Pick<RsaHeroBannerRow, 'title' | 'image_url' | 'route_name' | 'route_params' | 'display_order' | 'is_active'>>,
): Promise<{ data?: RsaHeroBannerRow; error?: string }> {
  const { rows, error } = await readRows();
  if (error) return { error };
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return { error: 'Banner not found' };
  const current = rows[index];
  const next: RsaHeroBannerRow = {
    ...current,
    ...(patch.title !== undefined ? { title: patch.title || null } : {}),
    ...(patch.image_url !== undefined ? { image_url: patch.image_url } : {}),
    ...(patch.route_name !== undefined ? { route_name: patch.route_name } : {}),
    ...(patch.route_params !== undefined ? { route_params: patch.route_params || {} } : {}),
    ...(patch.display_order !== undefined
      ? { display_order: Number.isFinite(Number(patch.display_order)) ? Number(patch.display_order) : 0 }
      : {}),
    ...(patch.is_active !== undefined ? { is_active: !!patch.is_active } : {}),
    updated_at: new Date().toISOString(),
  };
  const copy = [...rows];
  copy[index] = next;
  const saved = await writeRows(copy);
  if (saved.error) return { error: saved.error };
  return { data: next };
}

export async function deleteRsaHeroBanner(id: string): Promise<{ error?: string }> {
  const { rows, error } = await readRows();
  if (error) return { error };
  const next = rows.filter((row) => row.id !== id);
  if (next.length === rows.length) return { error: 'Banner not found' };
  return writeRows(next);
}
