import { apiFetch } from '../api';
import { filterWorkshopsForPincode } from './workshopPincode';

export type CrmWorkshopOption = {
  id: string;
  name: string;
  workshop_name?: string | null;
  service_center_name?: string | null;
  address?: string | null;
  short_address?: string | null;
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
    workshop_name: w.workshop_name || null,
    service_center_name: w.service_center_name || null,
    address: w.address || w.display_address || w.short_address || null,
    short_address: w.short_address || null,
    city: w.city || null,
    pincode: w.pincode || null,
  };
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
      rows = rows.filter((w) => String(w.city || '').toLowerCase().includes(city.toLowerCase())).slice(0, 40);
    } else rows = [];
  } else if (city) {
    rows = rows.filter((w) => String(w.city || '').toLowerCase().includes(city.toLowerCase())).slice(0, 40);
  }
  return rows.map(mapRow).filter((row) => row.id);
}

/** Same contract as web loadCrmWorkshops — PIN nearby + name search via /api/telecaller/crm/workshops */
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
    const json = await apiFetch<{ workshops?: unknown[] }>(
      `/api/telecaller/crm/workshops?${params.toString()}`,
      { timeoutMs: 20000 },
    );
    if (Array.isArray(json?.workshops) && json.workshops.length > 0) {
      return json.workshops.map(mapRow).filter((row) => row.id);
    }
  } catch {
    /* no local fallback without public list on mobile */
  }
  return filterLocal([], pin, city, q);
}