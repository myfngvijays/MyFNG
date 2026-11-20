import { createClient } from '@/lib/supabase/client';
import { filterWorkshopsForPincode } from '@/lib/whatsappBotFlow/workshopPincode';

export type CrmWorkshopOption = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
};

function mapRow(w: any): CrmWorkshopOption {
  const area = String(w.workshop_name || w.workshop_area || w.near_famous_area || '').trim();
  const center = String(w.service_center_name || '').trim();
  const rawName = String(w.name || '').trim();
  return {
    id: String(w.id || ''),
    name: area || center || rawName || 'Workshop',
    address: w.address || w.display_address || w.short_address || null,
    city: w.city || null,
    pincode: w.pincode || null,
  };
}

async function authHeaders(): Promise<HeadersInit> {
  try {
    const supabase = createClient();
    let { data } = await supabase.auth.getSession();
    const exp = Number(data.session?.expires_at || 0) * 1000;
    if (data.session && exp && exp < Date.now() + 15_000) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session) data = refreshed.data;
    }
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

let publicCache: any[] | null = null;
let publicAt = 0;

async function publicWorkshops(): Promise<any[]> {
  if (publicCache && Date.now() - publicAt < 60_000) return publicCache;
  const res = await fetch('/api/public/workshop-locator', { credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  publicCache = Array.isArray(json?.workshops) ? json.workshops : [];
  publicAt = Date.now();
  return publicCache;
}

function filterLocal(list: any[], pincode: string, city: string, q: string): CrmWorkshopOption[] {
  let rows = list;
  if (q.length >= 2) {
    const needle = q.toLowerCase();
    rows = rows
      .filter((w) =>
        `${w.name || ''} ${w.workshop_name || ''} ${w.workshop_area || ''} ${w.city || ''} ${w.pincode || ''}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 20);
  } else if (/^\d{6}$/.test(pincode)) {
    const nearby = filterWorkshopsForPincode(rows, pincode);
    if (nearby.length > 0) rows = nearby;
    else if (city) {
      rows = rows
        .filter((w) => String(w.city || '').toLowerCase().includes(city.toLowerCase()))
        .slice(0, 40);
    } else rows = [];
  } else if (city) {
    rows = rows
      .filter((w) => String(w.city || '').toLowerCase().includes(city.toLowerCase()))
      .slice(0, 40);
  }
  return rows.map(mapRow).filter((row) => row.id);
}

export async function loadCrmWorkshops(opts: {
  pincode?: string;
  city?: string;
  cityId?: string;
  q?: string;
}): Promise<CrmWorkshopOption[]> {
  const pin = String(opts.pincode || '').replace(/\D/g, '');
  const q = String(opts.q || '').trim();
  const city = String(opts.city || '').trim();
  const params = new URLSearchParams();
  if (q.length >= 2) params.set('q', q);
  else if (pin.length === 6) params.set('pincode', pin);
  if (city) params.set('city', city);
  if (opts.cityId) params.set('city_id', opts.cityId);

  try {
    const res = await fetch(`/api/telecaller/crm/workshops?${params.toString()}`, {
      credentials: 'same-origin',
      headers: await authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json?.workshops) && json.workshops.length > 0) {
      return json.workshops.map(mapRow).filter((row: CrmWorkshopOption) => row.id);
    }
  } catch {
    /* public list below */
  }

  return filterLocal(await publicWorkshops(), pin, city, q);
}
