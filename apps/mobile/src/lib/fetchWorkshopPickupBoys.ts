import { supabase } from './supabase';
import { apiFetch } from './api';

const PICKUP_BOY_ROLES = new Set(['WORKSHOP_PICKUP_BOY', 'PICKUP_BOY']);

export type PickupBoyOption = {
  id: string;
  full_name: string;
};

function normalize(rows: any[]): PickupBoyOption[] {
  return rows
    .filter((u) => PICKUP_BOY_ROLES.has(String(u.role_code || u.roles?.role_code || u.role?.role_code || '').toUpperCase()))
    .map((u) => ({
      id: String(u.id),
      full_name: String(u.full_name || u.email || 'Pickup').trim(),
    }));
}

/** Load pickup boys via API, then Supabase fallback for same workshop. */
export async function fetchWorkshopPickupBoys(workshopId: string): Promise<PickupBoyOption[]> {
  try {
    const json = await apiFetch<{ staff?: any[] }>('/api/workshop/staff');
    const fromApi = normalize(json.staff || []);
    if (fromApi.length > 0) return fromApi;
  } catch {
    // fall through to direct query
  }

  const { data, error } = await supabase
    .from('users_login')
    .select('id, full_name, email, roles!inner(role_code)')
    .eq('workshop_id', workshopId)
    .eq('is_active', true)
    .in('roles.role_code', ['WORKSHOP_PICKUP_BOY', 'PICKUP_BOY'])
    .order('full_name');

  if (error || !data?.length) {
    const { data: fallback } = await supabase
      .from('users_login')
      .select('id, full_name, email, role:role_id(role_code)')
      .eq('workshop_id', workshopId)
      .eq('is_active', true);

    return normalize(fallback || []);
  }

  return normalize(data);
}
